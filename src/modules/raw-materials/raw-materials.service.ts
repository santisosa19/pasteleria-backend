import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';

const rawMaterialInclude = {
  baseUnit: true,
} as const;

@Injectable()
export class RawMaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRawMaterialDto) {
    const name = this.normalizeName(dto.name);
    await this.ensureNameIsAvailable(name);
    await this.ensureBaseUnitExists(dto.baseUnitId);

    return this.prisma.rawMaterial.create({
      data: {
        name,
        description: this.cleanOptionalString(dto.description),
        baseUnitId: dto.baseUnitId,
        currentStock: dto.currentStock ?? 0,
        minimumStock: dto.minimumStock ?? 0,
        averageCost: dto.averageCost ?? 0,
        lastPurchaseCost: dto.lastPurchaseCost,
        isActive: dto.isActive ?? true,
      },
      include: rawMaterialInclude,
    });
  }

  findAll() {
    return this.prisma.rawMaterial.findMany({
      include: rawMaterialInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const rawMaterial = await this.prisma.rawMaterial.findUnique({
      include: rawMaterialInclude,
      where: { id },
    });

    if (!rawMaterial) {
      throw new NotFoundException('Materia prima no encontrada');
    }

    return rawMaterial;
  }

  async update(id: string, dto: UpdateRawMaterialDto) {
    await this.findOne(id);

    if (dto.name) {
      await this.ensureNameIsAvailable(this.normalizeName(dto.name), id);
    }

    if (dto.baseUnitId) {
      await this.ensureBaseUnitExists(dto.baseUnitId);
    }

    return this.prisma.rawMaterial.update({
      data: {
        name: dto.name ? this.normalizeName(dto.name) : undefined,
        description: this.cleanOptionalString(dto.description),
        baseUnitId: dto.baseUnitId,
        currentStock: dto.currentStock,
        minimumStock: dto.minimumStock,
        averageCost: dto.averageCost,
        lastPurchaseCost: dto.lastPurchaseCost,
        isActive: dto.isActive,
      },
      include: rawMaterialInclude,
      where: { id },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.rawMaterial.update({
      data: { isActive: false },
      include: rawMaterialInclude,
      where: { id },
    });
  }

  private async ensureNameIsAvailable(name: string, currentId?: string) {
    const existing = await this.prisma.rawMaterial.findUnique({
      where: { name },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException('El nombre de materia prima ya existe');
    }
  }

  private async ensureBaseUnitExists(baseUnitId: string) {
    const measurementUnit = await this.prisma.measurementUnit.findUnique({
      where: { id: baseUnitId },
    });

    if (!measurementUnit) {
      throw new NotFoundException('Unidad base no encontrada');
    }

    if (!measurementUnit.isBase) {
      throw new BadRequestException(
        'Las materias primas deben usar una unidad base',
      );
    }
  }

  private normalizeName(name: string) {
    return name.trim();
  }

  private cleanOptionalString(value?: string) {
    const trimmed = value?.trim();

    return trimmed || undefined;
  }
}
