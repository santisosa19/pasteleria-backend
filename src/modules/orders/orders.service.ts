import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderChannel, OrderStatus } from '@prisma/client';
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
