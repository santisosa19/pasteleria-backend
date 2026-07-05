import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const customerInclude = {
  _count: {
    select: {
      orders: true,
    },
  },
} as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: this.cleanOptionalString(dto.lastName),
        email: this.cleanOptionalString(dto.email),
        phone: this.cleanOptionalString(dto.phone),
        address: this.cleanOptionalString(dto.address),
      },
      include: customerInclude,
    });
  }

  findAll() {
    return this.prisma.customer.findMany({
      include: customerInclude,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      include: customerInclude,
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);

    return this.prisma.customer.update({
      data: {
        firstName: dto.firstName?.trim(),
        lastName: this.cleanOptionalString(dto.lastName),
        email: this.cleanOptionalString(dto.email),
        phone: this.cleanOptionalString(dto.phone),
        address: this.cleanOptionalString(dto.address),
      },
      include: customerInclude,
      where: { id },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    try {
      await this.prisma.customer.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException('El cliente ya esta en uso');
      }

      throw error;
    }

    return { success: true };
  }

  private cleanOptionalString(value?: string) {
    const trimmed = value?.trim();

    return trimmed || undefined;
  }
}
