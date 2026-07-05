import { BadRequestException, Injectable } from '@nestjs/common';
import {
  SaleStatus,
  StockMovementSourceType,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ReportPeriodQueryDto } from './dto/report-period-query.dto';

type DateRange = {
  from?: Date;
  to?: Date;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesSummary(query: ReportPeriodQueryDto) {
    const range = this.getDateRange(query);
    const sales = await this.prisma.sale.findMany({
      select: {
        subtotal: true,
        discount: true,
        totalAmount: true,
        grossProfit: true,
      },
      where: {
        status: SaleStatus.CONFIRMED,
        soldAt: this.toDateFilter(range),
      },
    });
    const subtotal = this.sum(sales.map((sale) => Number(sale.subtotal)));
    const discount = this.sum(sales.map((sale) => Number(sale.discount)));
    const totalAmount = this.sum(sales.map((sale) => Number(sale.totalAmount)));
    const grossProfit = this.sum(sales.map((sale) => Number(sale.grossProfit)));

    return {
      period: this.toPeriodResponse(range),
      salesCount: sales.length,
      subtotal,
      discount,
      totalAmount,
      grossProfit,
      marginPercent: totalAmount > 0 ? (grossProfit / totalAmount) * 100 : 0,
    };
  }

  async getProductMargins(query: ReportPeriodQueryDto) {
    const range = this.getDateRange(query);
    const saleItems = await this.prisma.saleItem.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      where: {
        sale: {
          status: SaleStatus.CONFIRMED,
          soldAt: this.toDateFilter(range),
        },
      },
    });
    const byProduct = new Map<
      string,
      {
        productId: string;
        productName: string;
        sku?: string | null;
        quantitySold: number;
        revenue: number;
        estimatedCost: number;
        grossProfit: number;
      }
    >();

    for (const item of saleItems) {
      const current = byProduct.get(item.productId) ?? {
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        quantitySold: 0,
        revenue: 0,
        estimatedCost: 0,
        grossProfit: 0,
      };
      const quantity = Number(item.quantity);
      const estimatedCost = Number(item.unitCostEstimate) * quantity;

      current.quantitySold += quantity;
      current.revenue += Number(item.subtotal);
      current.estimatedCost += estimatedCost;
      current.grossProfit += Number(item.profitEstimate);
      byProduct.set(item.productId, current);
    }

    return {
      period: this.toPeriodResponse(range),
      products: Array.from(byProduct.values())
        .map((product) => ({
          ...product,
          marginPercent:
            product.revenue > 0
              ? (product.grossProfit / product.revenue) * 100
              : 0,
        }))
        .sort((a, b) => b.grossProfit - a.grossProfit),
    };
  }

  async getPurchasesBySupplier(query: ReportPeriodQueryDto) {
    const range = this.getDateRange(query);
    const purchases = await this.prisma.purchase.findMany({
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      where: {
        purchasedAt: this.toDateFilter(range),
      },
    });
    const bySupplier = new Map<
      string,
      {
        supplierId: string | null;
        supplierName: string;
        purchasesCount: number;
        totalAmount: number;
      }
    >();

    for (const purchase of purchases) {
      const key = purchase.supplierId ?? 'without-supplier';
      const current = bySupplier.get(key) ?? {
        supplierId: purchase.supplierId,
        supplierName: purchase.supplier?.name ?? 'Sin proveedor',
        purchasesCount: 0,
        totalAmount: 0,
      };

      current.purchasesCount += 1;
      current.totalAmount += Number(purchase.totalAmount);
      bySupplier.set(key, current);
    }

    return {
      period: this.toPeriodResponse(range),
      purchasesCount: purchases.length,
      totalAmount: this.sum(
        purchases.map((purchase) => Number(purchase.totalAmount)),
      ),
      suppliers: Array.from(bySupplier.values()).sort(
        (a, b) => b.totalAmount - a.totalAmount,
      ),
    };
  }

  async getRawMaterialConsumption(query: ReportPeriodQueryDto) {
    const range = this.getDateRange(query);
    const cancelledSaleIds = await this.prisma.sale.findMany({
      select: { id: true },
      where: { status: SaleStatus.CANCELLED },
    });
    const movements = await this.prisma.stockMovement.findMany({
      include: {
        rawMaterial: {
          include: {
            baseUnit: true,
          },
        },
      },
      where: {
        type: StockMovementType.SALE_OUT,
        sourceType: StockMovementSourceType.SALE,
        sourceId: cancelledSaleIds.length
          ? { notIn: cancelledSaleIds.map((sale) => sale.id) }
          : undefined,
        createdAt: this.toDateFilter(range),
      },
    });
    const byRawMaterial = new Map<
      string,
      {
        rawMaterialId: string;
        rawMaterialName: string;
        baseUnitCode: string;
        quantityBase: number;
        estimatedCost: number;
      }
    >();

    for (const movement of movements) {
      const current = byRawMaterial.get(movement.rawMaterialId) ?? {
        rawMaterialId: movement.rawMaterialId,
        rawMaterialName: movement.rawMaterial.name,
        baseUnitCode: movement.rawMaterial.baseUnit.code,
        quantityBase: 0,
        estimatedCost: 0,
      };
      const quantityBase = Number(movement.quantityBase);
      const unitCostSnapshot = Number(movement.unitCostSnapshot ?? 0);

      current.quantityBase += quantityBase;
      current.estimatedCost += quantityBase * unitCostSnapshot;
      byRawMaterial.set(movement.rawMaterialId, current);
    }

    return {
      period: this.toPeriodResponse(range),
      rawMaterials: Array.from(byRawMaterial.values()).sort(
        (a, b) => b.estimatedCost - a.estimatedCost,
      ),
    };
  }

  private getDateRange(query: ReportPeriodQueryDto): DateRange {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    if (from && to && from > to) {
      throw new BadRequestException(
        'La fecha inicial debe ser anterior a la fecha final',
      );
    }

    return { from, to };
  }

  private toDateFilter(range: DateRange) {
    if (!range.from && !range.to) {
      return undefined;
    }

    return {
      gte: range.from,
      lte: range.to,
    };
  }

  private toPeriodResponse(range: DateRange) {
    return {
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
    };
  }

  private sum(values: number[]) {
    return values.reduce((total, value) => total + value, 0);
  }
}
