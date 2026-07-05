import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        name: dto.name.trim(),
        taxId: this.cleanOptionalString(dto.taxId),
        email: this.cleanOptionalString(dto.email),
        phone: this.cleanOptionalString(dto.phone),
        address: this.cleanOptionalString(dto.address),
        notes: this.cleanOptionalString(dto.notes),
        isActive: dto.isActive ?? true,
      },
    });
  }

  findAll() {
    return this.prisma.supplier.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);

    return this.prisma.supplier.update({
      data: {
        name: dto.name?.trim(),
        taxId: this.cleanOptionalString(dto.taxId),
        email: this.cleanOptionalString(dto.email),
        phone: this.cleanOptionalString(dto.phone),
        address: this.cleanOptionalString(dto.address),
        notes: this.cleanOptionalString(dto.notes),
        isActive: dto.isActive,
      },
      where: { id },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.supplier.update({
      data: { isActive: false },
      where: { id },
    });
  }

  private cleanOptionalString(value?: string) {
    const trimmed = value?.trim();

    return trimmed || undefined;
  }
}
