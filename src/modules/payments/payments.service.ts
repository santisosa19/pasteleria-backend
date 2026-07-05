import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';

const paymentInclude = {
  order: {
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  },
} as const;

const allowedStatusTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.APPROVED, PaymentStatus.REJECTED],
  [PaymentStatus.APPROVED]: [PaymentStatus.REFUNDED],
  [PaymentStatus.REJECTED]: [],
  [PaymentStatus.REFUNDED]: [],
};

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto, user: AuthenticatedUser) {
    const provider = this.normalizeProvider(dto.provider);
    const status = dto.status ?? PaymentStatus.APPROVED;

    if (status === PaymentStatus.REFUNDED) {
      throw new BadRequestException(
        'No se puede crear un pago directamente como reembolsado.',
      );
    }

    if (dto.providerPaymentId) {
      await this.ensureProviderPaymentIsAvailable(
        provider,
        dto.providerPaymentId,
      );
    }

    if (dto.orderId) {
      await this.ensureOrderCanReceivePayment(dto.orderId, dto.amount);
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: dto.orderId,
          provider,
          providerPaymentId: this.cleanOptionalString(dto.providerPaymentId),
          status,
          amount: dto.amount,
          paidAt: this.getPaidAt(status, dto.paidAt),
          rawPayload: dto.rawPayload as Prisma.InputJsonValue | undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'payments.create',
          entityName: 'Payment',
          entityId: payment.id,
          metadata: {
            amount: dto.amount,
            orderId: dto.orderId ?? null,
            provider,
            status,
          },
        },
      });

      return tx.payment.findUniqueOrThrow({
        include: paymentInclude,
        where: { id: payment.id },
      });
    });
  }

  findAll(query: PaymentQueryDto) {
    return this.prisma.payment.findMany({
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
      where: {
        orderId: query.orderId,
        provider: query.provider
          ? this.normalizeProvider(query.provider)
          : undefined,
        status: query.status,
      },
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      include: paymentInclude,
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado.');
    }

    return payment;
  }

  async updateStatus(
    id: string,
    dto: UpdatePaymentStatusDto,
    user: AuthenticatedUser,
  ) {
    const payment = await this.findOne(id);

    if (payment.status === dto.status) {
      return payment;
    }

    if (!allowedStatusTransitions[payment.status].includes(dto.status)) {
      throw new ConflictException(
        `No se puede cambiar el estado del pago de ${payment.status} a ${dto.status}.`,
      );
    }

    if (dto.status === PaymentStatus.APPROVED && payment.orderId) {
      await this.ensureOrderCanReceivePayment(
        payment.orderId,
        Number(payment.amount),
        payment.id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        data: {
          status: dto.status,
          paidAt: this.getPaidAt(dto.status, dto.paidAt),
        },
        include: paymentInclude,
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'payments.status.update',
          entityName: 'Payment',
          entityId: id,
          metadata: {
            from: payment.status,
            to: dto.status,
          },
        },
      });

      return updatedPayment;
    });
  }

  private async ensureOrderCanReceivePayment(
    orderId: string,
    amount: number,
    ignoredPaymentId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      include: {
        payments: true,
      },
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede pagar un pedido cancelado.');
    }

    const approvedAmount = order.payments
      .filter(
        (payment) =>
          payment.status === PaymentStatus.APPROVED &&
          payment.id !== ignoredPaymentId,
      )
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const pendingAmount = Number(order.totalAmount) - approvedAmount;

    if (amount > pendingAmount) {
      throw new BadRequestException(
        'El monto del pago supera el saldo pendiente del pedido.',
      );
    }
  }

  private async ensureProviderPaymentIsAvailable(
    provider: string,
    providerPaymentId: string,
  ) {
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        provider,
        providerPaymentId,
      },
    });

    if (existingPayment) {
      throw new ConflictException(
        'Ya existe un pago registrado con ese identificador del proveedor.',
      );
    }
  }

  private getPaidAt(status: PaymentStatus, paidAt?: string) {
    if (status !== PaymentStatus.APPROVED) {
      return null;
    }

    return paidAt ? new Date(paidAt) : new Date();
  }

  private normalizeProvider(provider?: string) {
    return this.cleanOptionalString(provider)?.toLowerCase() ?? 'manual';
  }

  private cleanOptionalString(value?: string) {
    const trimmed = value?.trim();

    return trimmed || undefined;
  }
}
