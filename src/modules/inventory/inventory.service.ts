import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StockMovementSourceType, StockMovementType } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';

const stockMovementInclude = {
  rawMaterial: {
    include: {
      baseUnit: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  findMovements(query: StockMovementQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    if (from && to && from > to) {
      throw new BadRequestException(
        'La fecha inicial debe ser anterior a la fecha final',
      );
    }

    return this.prisma.stockMovement.findMany({
      include: stockMovementInclude,
      orderBy: { createdAt: 'desc' },
      take: query.take ?? 100,
      where: {
        rawMaterialId: query.rawMaterialId,
        sourceType: query.sourceType,
        type: query.type,
        createdAt:
          from || to
            ? {
                gte: from,
                lte: to,
              }
            : undefined,
      },
    });
  }

  async createAdjustment(
    dto: CreateStockAdjustmentDto,
    user: AuthenticatedUser,
  ) {
    const note = dto.note.trim();

    if (!note) {
      throw new BadRequestException('La nota del ajuste es obligatoria');
    }

    const rawMaterial = await this.prisma.rawMaterial.findUnique({
      include: {
        baseUnit: true,
      },
      where: { id: dto.rawMaterialId },
    });

    if (!rawMaterial) {
      throw new NotFoundException('Materia prima no encontrada');
    }

    if (!rawMaterial.isActive) {
      throw new BadRequestException('La materia prima esta inactiva');
    }

    const unit = await this.prisma.measurementUnit.findUnique({
      where: { id: dto.unitId },
    });

    if (!unit) {
      throw new NotFoundException('Unidad de ajuste no encontrada');
    }

    if (unit.kind !== rawMaterial.baseUnit.kind) {
      throw new BadRequestException(
        'El tipo de unidad del ajuste debe coincidir con la unidad base de la materia prima',
      );
    }

    const quantityBase = dto.quantity * Number(unit.conversionRateToBase);
    const currentStock = Number(rawMaterial.currentStock);
    const stockDelta =
      dto.type === StockMovementType.ADJUSTMENT_IN
        ? quantityBase
        : -quantityBase;
    const nextStock = currentStock + stockDelta;

    if (nextStock < 0) {
      throw new BadRequestException('El ajuste dejaria stock negativo');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.rawMaterial.update({
        data: { currentStock: nextStock },
        where: { id: dto.rawMaterialId },
      });

      const stockMovement = await tx.stockMovement.create({
        data: {
          rawMaterialId: dto.rawMaterialId,
          type: dto.type,
          quantityBase,
          unitCostSnapshot: rawMaterial.averageCost,
          sourceType: StockMovementSourceType.MANUAL_ADJUSTMENT,
          note,
          createdById: user.id,
        },
        include: stockMovementInclude,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'inventory.adjustment.create',
          entityName: 'StockMovement',
          entityId: stockMovement.id,
          metadata: {
            nextStock,
            quantityBase,
            rawMaterialId: dto.rawMaterialId,
            type: dto.type,
          },
        },
      });

      return stockMovement;
    });
  }

  async findLowStock() {
    const rawMaterials = await this.prisma.rawMaterial.findMany({
      include: {
        baseUnit: true,
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      where: {
        isActive: true,
      },
    });

    return rawMaterials.filter(
      (rawMaterial) =>
        Number(rawMaterial.currentStock) <= Number(rawMaterial.minimumStock),
    );
  }
}
