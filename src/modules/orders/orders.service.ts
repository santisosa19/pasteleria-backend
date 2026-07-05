import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderChannel,
  OrderStatus,
  Prisma,
  StockMovementSourceType,
  StockMovementType,
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderItemDto } from './dto/order-item.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const orderInclude = {
  customer: true,
  items: {
    include: {
      product: true,
    },
  },
  payments: true,
  sale: true,
} as const;

type CalculatedOrderItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

type CalculatedSaleItem = CalculatedOrderItem & {
  unitCostEstimate: number;
  profitEstimate: number;
};

type StockConsumption = {
  rawMaterialId: string;
  quantityBase: number;
  unitCostSnapshot: number;
};

const allowedStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [
    OrderStatus.IN_PRODUCTION,
    OrderStatus.READY,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.IN_PRODUCTION]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    const channel = dto.channel ?? OrderChannel.INTERNAL;

    if (dto.customerId) {
      await this.ensureCustomerExists(dto.customerId);
    }

    const items = await this.calculateItems(dto.items, channel);
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = dto.discount ?? 0;

    if (discount > subtotal) {
      throw new BadRequestException(
        'El descuento no puede ser mayor al subtotal',
      );
    }

    return this.prisma.order.create({
      data: {
        customerId: dto.customerId,
        channel,
        requestedDate: dto.requestedDate
          ? new Date(dto.requestedDate)
          : undefined,
        subtotal,
        discount,
        totalAmount: subtotal - discount,
        notes: this.cleanOptionalString(dto.notes),
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
        },
      },
      include: orderInclude,
    });
  }

  findAll() {
    return this.prisma.order.findMany({
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      include: orderInclude,
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);

    if (order.status === dto.status) {
      return order;
    }

    if (!allowedStatusTransitions[order.status].includes(dto.status)) {
      throw new ConflictException(
        `No se puede cambiar el estado del pedido de ${order.status} a ${dto.status}`,
      );
    }

    return this.prisma.order.update({
      data: { status: dto.status },
      include: orderInclude,
      where: { id },
    });
  }

  async convertToSale(id: string, user: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({
      include: {
        sale: true,
        items: {
          include: {
            product: {
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
            },
          },
        },
      },
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.sale) {
      throw new ConflictException('El pedido ya fue convertido en venta');
    }

    if (order.status === OrderStatus.PENDING) {
      throw new BadRequestException(
        'El pedido debe estar confirmado antes de convertirlo en venta',
      );
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede vender un pedido cancelado');
    }

    const { items, stockConsumptions } = this.calculateSaleFromOrder(
      order.items,
    );
    const totalCost = items.reduce(
      (sum, item) => sum + item.unitCostEstimate * item.quantity,
      0,
    );
    const grossProfit = Number(order.totalAmount) - totalCost;

    return this.prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.create({
          data: {
            orderId: order.id,
            soldAt: new Date(),
            subtotal: order.subtotal,
            discount: order.discount,
            totalAmount: order.totalAmount,
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

        await tx.order.update({
          data: { status: OrderStatus.DELIVERED },
          where: { id: order.id },
        });

        return tx.sale.findUniqueOrThrow({
          include: {
            order: {
              include: {
                customer: true,
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
            items: {
              include: {
                product: true,
              },
            },
          },
          where: { id: sale.id },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async calculateItems(items: OrderItemDto[], channel: OrderChannel) {
    this.ensureUniqueProducts(items);

    const calculatedItems: CalculatedOrderItem[] = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException('Producto no encontrado');
      }

      if (!product.isActive) {
        throw new BadRequestException('El producto esta inactivo');
      }

      if (channel === OrderChannel.ECOMMERCE && !product.isPublished) {
        throw new BadRequestException('El producto no esta publicado');
      }

      const unitPrice = item.unitPrice ?? Number(product.salePrice);

      calculatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity,
      });
    }

    return calculatedItems;
  }

  private ensureUniqueProducts(items: OrderItemDto[]) {
    const productIds = new Set<string>();

    for (const item of items) {
      if (productIds.has(item.productId)) {
        throw new ConflictException(
          'El pedido no puede contener el mismo producto dos veces',
        );
      }

      productIds.add(item.productId);
    }
  }

  private calculateSaleFromOrder(
    items: Array<{
      productId: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      product: {
        isActive: boolean;
        recipe: {
          isActive: boolean;
          yieldQuantity: Prisma.Decimal;
          ingredients: Array<{
            rawMaterialId: string;
            quantity: Prisma.Decimal;
            unit: { conversionRateToBase: Prisma.Decimal };
            rawMaterial: {
              isActive: boolean;
              averageCost: Prisma.Decimal;
            };
          }>;
        } | null;
      };
    }>,
  ) {
    const calculatedItems: CalculatedSaleItem[] = [];
    const stockConsumptions = new Map<string, StockConsumption>();

    for (const item of items) {
      if (!item.product.isActive) {
        throw new BadRequestException('El producto esta inactivo');
      }

      if (!item.product.recipe) {
        throw new BadRequestException('El producto no tiene receta asignada');
      }

      if (!item.product.recipe.isActive) {
        throw new BadRequestException('La receta del producto esta inactiva');
      }

      const quantity = Number(item.quantity);
      const recipeYieldQuantity = Number(item.product.recipe.yieldQuantity);
      const unitPrice = Number(item.unitPrice);
      let unitCostEstimate = 0;

      for (const ingredient of item.product.recipe.ingredients) {
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
        const totalQuantityBase = quantityBasePerSaleUnit * quantity;
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

      const subtotal = Number(item.subtotal);

      calculatedItems.push({
        productId: item.productId,
        quantity,
        unitPrice,
        subtotal,
        unitCostEstimate,
        profitEstimate: subtotal - unitCostEstimate * quantity,
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
        note: 'Salida de stock por venta desde pedido',
        createdById: userId,
      },
    });
  }

  private async ensureCustomerExists(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }
  }

  private cleanOptionalString(value?: string) {
    const trimmed = value?.trim();

    return trimmed || undefined;
  }
}
