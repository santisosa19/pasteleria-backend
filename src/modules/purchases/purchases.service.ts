import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockMovementSourceType,
  StockMovementType,
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseItemDto } from './dto/purchase-item.dto';

const purchaseInclude = {
  supplier: true,
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
      rawMaterial: {
        include: {
          baseUnit: true,
        },
      },
      unit: true,
    },
  },
} as const;

type CalculatedPurchaseItem = {
  rawMaterialId: string;
  quantity: number;
  unitId: string;
  unitCost: number;
  subtotal: number;
  quantityBase: number;
  unitCostBase: number;
};

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchaseDto, user: AuthenticatedUser) {
    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    const items = await this.calculateItems(dto.items);
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          supplierId: dto.supplierId,
          invoiceNo: this.cleanOptionalString(dto.invoiceNo),
          purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
          totalAmount,
          notes: this.cleanOptionalString(dto.notes),
          createdById: user.id,
          items: {
            create: items.map((item) => ({
              rawMaterialId: item.rawMaterialId,
              quantity: item.quantity,
              unitId: item.unitId,
              unitCost: item.unitCost,
              subtotal: item.subtotal,
            })),
          },
        },
      });

      for (const item of items) {
        await this.applyStockEntry(tx, purchase.id, item, user.id);
      }

      return tx.purchase.findUniqueOrThrow({
        include: purchaseInclude,
        where: { id: purchase.id },
      });
    });
  }

  findAll() {
    return this.prisma.purchase.findMany({
      include: purchaseInclude,
      orderBy: { purchasedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      include: purchaseInclude,
      where: { id },
    });

    if (!purchase) {
      throw new NotFoundException('Compra no encontrada');
    }

    return purchase;
  }

  private async calculateItems(items: PurchaseItemDto[]) {
    const calculatedItems: CalculatedPurchaseItem[] = [];

    for (const item of items) {
      const rawMaterial = await this.prisma.rawMaterial.findUnique({
        include: {
          baseUnit: true,
        },
        where: { id: item.rawMaterialId },
      });

      if (!rawMaterial) {
        throw new NotFoundException('Materia prima no encontrada');
      }

      if (!rawMaterial.isActive) {
        throw new BadRequestException('La materia prima esta inactiva');
      }

      const unit = await this.prisma.measurementUnit.findUnique({
        where: { id: item.unitId },
      });

      if (!unit) {
        throw new NotFoundException('Unidad del item de compra no encontrada');
      }

      if (unit.kind !== rawMaterial.baseUnit.kind) {
        throw new BadRequestException(
          'El tipo de unidad del item de compra debe coincidir con la unidad base de la materia prima',
        );
      }

      const conversionRate = Number(unit.conversionRateToBase);
      const quantityBase = item.quantity * conversionRate;
      const unitCostBase = item.unitCost / conversionRate;

      calculatedItems.push({
        rawMaterialId: item.rawMaterialId,
        quantity: item.quantity,
        unitId: item.unitId,
        unitCost: item.unitCost,
        subtotal: item.quantity * item.unitCost,
        quantityBase,
        unitCostBase,
      });
    }

    return calculatedItems;
  }

  private async applyStockEntry(
    tx: Prisma.TransactionClient,
    purchaseId: string,
    item: CalculatedPurchaseItem,
    userId: string,
  ) {
    const rawMaterial = await tx.rawMaterial.findUnique({
      where: { id: item.rawMaterialId },
    });

    if (!rawMaterial) {
      throw new NotFoundException('Materia prima no encontrada');
    }

    const currentStock = Number(rawMaterial.currentStock);
    const currentAverageCost = Number(rawMaterial.averageCost);
    const nextStock = currentStock + item.quantityBase;
    const nextAverageCost =
      nextStock > 0
        ? (currentStock * currentAverageCost +
            item.quantityBase * item.unitCostBase) /
          nextStock
        : item.unitCostBase;

    await tx.rawMaterial.update({
      data: {
        currentStock: nextStock,
        averageCost: nextAverageCost,
        lastPurchaseCost: item.unitCostBase,
      },
      where: { id: item.rawMaterialId },
    });

    await tx.stockMovement.create({
      data: {
        rawMaterialId: item.rawMaterialId,
        type: StockMovementType.PURCHASE_IN,
        quantityBase: item.quantityBase,
        unitCostSnapshot: item.unitCostBase,
        sourceType: StockMovementSourceType.PURCHASE,
        sourceId: purchaseId,
        note: 'Entrada de stock por compra',
        createdById: userId,
      },
    });
  }

  private async ensureSupplierExists(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    if (!supplier.isActive) {
      throw new BadRequestException('El proveedor esta inactivo');
    }
  }

  private cleanOptionalString(value?: string) {
    const trimmed = value?.trim();

    return trimmed || undefined;
  }
}
