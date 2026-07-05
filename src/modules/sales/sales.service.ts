import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockMovementSourceType,
  StockMovementType,
  SaleStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleItemDto } from './dto/sale-item.dto';

const saleInclude = {
  createdBy: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
    },
  },
  items: {
    include: {
      product: {
        include: {
          recipe: true,
        },
      },
    },
  },
} as const;

type CalculatedSaleItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
  unitCostEstimate: number;
  subtotal: number;
  profitEstimate: number;
};

type StockConsumption = {
  rawMaterialId: string;
  quantityBase: number;
  unitCostSnapshot: number;
};

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSaleDto, user: AuthenticatedUser) {
    this.ensureUniqueProducts(dto.items);

    const { items, stockConsumptions } = await this.calculateSale(dto.items);
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = dto.discount ?? 0;

    if (discount > subtotal) {
      throw new BadRequestException(
        'El descuento no puede ser mayor al subtotal',
      );
    }

    const totalCost = items.reduce(
      (sum, item) => sum + item.unitCostEstimate * item.quantity,
      0,
    );
    const totalAmount = subtotal - discount;
    const grossProfit = totalAmount - totalCost;

    return this.prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.create({
          data: {
            soldAt: dto.soldAt ? new Date(dto.soldAt) : new Date(),
            subtotal,
            discount,
            totalAmount,
            grossProfit,
            createdById: user.id,
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                unitCostEstimate: item.unitCostEstimate,
                subtotal: item.subtotal,
                profitEstimate: item.profitEstimate,
              })),
            },
          },
        });

        for (const consumption of stockConsumptions) {
          await this.applyStockOutput(tx, sale.id, consumption, user.id);
        }

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: 'sales.create',
            entityName: 'Sale',
            entityId: sale.id,
            metadata: {
              grossProfit,
              itemsCount: items.length,
              totalAmount,
            },
          },
        });

        return tx.sale.findUniqueOrThrow({
          include: saleInclude,
          where: { id: sale.id },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  findAll() {
    return this.prisma.sale.findMany({
      include: saleInclude,
      orderBy: { soldAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      include: saleInclude,
      where: { id },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    return sale;
  }

  async cancel(id: string, dto: CancelSaleDto, user: AuthenticatedUser) {
    const sale = await this.findOne(id);

    if (sale.status === SaleStatus.CANCELLED) {
      throw new ConflictException('La venta ya esta cancelada');
    }

    const stockMovements = await this.prisma.stockMovement.findMany({
      where: {
        sourceId: id,
        sourceType: StockMovementSourceType.SALE,
        type: StockMovementType.SALE_OUT,
      },
    });

    return this.prisma.$transaction(
      async (tx) => {
        for (const movement of stockMovements) {
          await this.applyStockReturn(
            tx,
            sale.id,
            movement.rawMaterialId,
            Number(movement.quantityBase),
            movement.unitCostSnapshot,
            user.id,
            dto.reason,
          );
        }

        const cancelledSale = await tx.sale.update({
          data: { status: SaleStatus.CANCELLED },
          include: saleInclude,
          where: { id },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: 'sales.cancel',
            entityName: 'Sale',
            entityId: sale.id,
            metadata: {
              reason: dto.reason?.trim() || null,
              reversedMovements: stockMovements.length,
            },
          },
        });

        return cancelledSale;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async calculateSale(items: SaleItemDto[]) {
    const calculatedItems: CalculatedSaleItem[] = [];
    const stockConsumptions = new Map<string, StockConsumption>();

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        include: {
          recipe: {
            include: {
              ingredients: {
                include: {
                  rawMaterial: true,
                  unit: true,
                },
              },
            },
          },
        },
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException('Producto no encontrado');
      }

      if (!product.isActive) {
        throw new BadRequestException('El producto esta inactivo');
      }

      if (!product.recipe) {
        throw new BadRequestException('El producto no tiene receta asignada');
      }

      if (!product.recipe.isActive) {
        throw new BadRequestException('La receta del producto esta inactiva');
      }

      const recipeYieldQuantity = Number(product.recipe.yieldQuantity);
      const unitPrice = item.unitPrice ?? Number(product.salePrice);
      let unitCostEstimate = 0;

      for (const ingredient of product.recipe.ingredients) {
        if (!ingredient.rawMaterial.isActive) {
          throw new BadRequestException(
            'La receta contiene una materia prima inactiva',
          );
        }

        const ingredientQuantityBase =
          Number(ingredient.quantity) *
          Number(ingredient.unit.conversionRateToBase);
        const quantityBasePerSaleUnit =
          ingredientQuantityBase / recipeYieldQuantity;
        const totalQuantityBase = quantityBasePerSaleUnit * item.quantity;
        const unitCostSnapshot = Number(ingredient.rawMaterial.averageCost);

        unitCostEstimate += quantityBasePerSaleUnit * unitCostSnapshot;

        const currentConsumption = stockConsumptions.get(
          ingredient.rawMaterialId,
        );

        stockConsumptions.set(ingredient.rawMaterialId, {
          rawMaterialId: ingredient.rawMaterialId,
          quantityBase:
            (currentConsumption?.quantityBase ?? 0) + totalQuantityBase,
          unitCostSnapshot,
        });
      }

      const subtotal = unitPrice * item.quantity;

      calculatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        unitCostEstimate,
        subtotal,
        profitEstimate: subtotal - unitCostEstimate * item.quantity,
      });
    }

    return {
      items: calculatedItems,
      stockConsumptions: Array.from(stockConsumptions.values()),
    };
  }

  private async applyStockOutput(
    tx: Prisma.TransactionClient,
    saleId: string,
    consumption: StockConsumption,
    userId: string,
  ) {
    const rawMaterial = await tx.rawMaterial.findUnique({
      where: { id: consumption.rawMaterialId },
    });

    if (!rawMaterial) {
      throw new NotFoundException('Materia prima no encontrada');
    }

    const currentStock = Number(rawMaterial.currentStock);
    const nextStock = currentStock - consumption.quantityBase;

    if (nextStock < 0) {
      throw new BadRequestException(
        `Stock insuficiente para la materia prima ${rawMaterial.name}`,
      );
    }

    await tx.rawMaterial.update({
      data: { currentStock: nextStock },
      where: { id: consumption.rawMaterialId },
    });

    await tx.stockMovement.create({
      data: {
        rawMaterialId: consumption.rawMaterialId,
        type: StockMovementType.SALE_OUT,
        quantityBase: consumption.quantityBase,
        unitCostSnapshot: consumption.unitCostSnapshot,
        sourceType: StockMovementSourceType.SALE,
        sourceId: saleId,
        note: 'Salida de stock por venta',
        createdById: userId,
      },
    });
  }

  private async applyStockReturn(
    tx: Prisma.TransactionClient,
    saleId: string,
    rawMaterialId: string,
    quantityBase: number,
    unitCostSnapshot: Prisma.Decimal | null,
    userId: string,
    reason?: string,
  ) {
    const rawMaterial = await tx.rawMaterial.findUnique({
      where: { id: rawMaterialId },
    });

    if (!rawMaterial) {
      throw new NotFoundException('Materia prima no encontrada');
    }

    await tx.rawMaterial.update({
      data: {
        currentStock: Number(rawMaterial.currentStock) + quantityBase,
      },
      where: { id: rawMaterialId },
    });

    await tx.stockMovement.create({
      data: {
        rawMaterialId,
        type: StockMovementType.ADJUSTMENT_IN,
        quantityBase,
        unitCostSnapshot,
        sourceType: StockMovementSourceType.SALE,
        sourceId: saleId,
        note: this.buildCancellationNote(reason),
        createdById: userId,
      },
    });
  }

  private buildCancellationNote(reason?: string) {
    const trimmedReason = reason?.trim();

    if (!trimmedReason) {
      return 'Reversa de stock por cancelacion de venta';
    }

    return `Reversa de stock por cancelacion de venta: ${trimmedReason}`;
  }

  private ensureUniqueProducts(items: SaleItemDto[]) {
    const productIds = new Set<string>();

    for (const item of items) {
      if (productIds.has(item.productId)) {
        throw new ConflictException(
          'La venta no puede contener el mismo producto dos veces',
        );
      }

      productIds.add(item.productId);
    }
  }
}
