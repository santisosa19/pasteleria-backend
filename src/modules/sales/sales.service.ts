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
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
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
