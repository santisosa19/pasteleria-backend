import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MeasurementKind, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateMeasurementUnitDto } from './dto/create-measurement-unit.dto';
import { UpdateMeasurementUnitDto } from './dto/update-measurement-unit.dto';

@Injectable()
export class MeasurementUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMeasurementUnitDto) {
    const code = this.normalizeCode(dto.code);
    await this.ensureCodeIsAvailable(code);
    await this.ensureBaseRules(
      dto.kind,
      dto.isBase ?? false,
      dto.conversionRateToBase,
    );

    return this.prisma.measurementUnit.create({
      data: {
        code,
        name: dto.name.trim(),
        kind: dto.kind,
        conversionRateToBase: dto.conversionRateToBase,
        isBase: dto.isBase ?? false,
      },
    });
  }

  findAll() {
    return this.prisma.measurementUnit.findMany({
      orderBy: [{ kind: 'asc' }, { code: 'asc' }],
    });
  }

  async findOne(id: string) {
    const measurementUnit = await this.prisma.measurementUnit.findUnique({
      where: { id },
    });

    if (!measurementUnit) {
      throw new NotFoundException('Measurement unit not found');
    }

    return measurementUnit;
  }

  async update(id: string, dto: UpdateMeasurementUnitDto) {
    const current = await this.findOne(id);

    if (dto.code) {
      await this.ensureCodeIsAvailable(this.normalizeCode(dto.code), id);
    }

    const nextKind = dto.kind ?? current.kind;
    const nextIsBase = dto.isBase ?? current.isBase;
    const nextConversionRate =
      dto.conversionRateToBase ?? Number(current.conversionRateToBase);

    await this.ensureBaseRules(nextKind, nextIsBase, nextConversionRate, id);

    return this.prisma.measurementUnit.update({
      data: {
        code: dto.code ? this.normalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        kind: dto.kind,
        conversionRateToBase: dto.conversionRateToBase,
        isBase: dto.isBase,
      },
      where: { id },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    try {
      await this.prisma.measurementUnit.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException('Measurement unit is already in use');
      }

      throw error;
    }

    return { success: true };
  }

  private async ensureCodeIsAvailable(code: string, currentId?: string) {
    const existing = await this.prisma.measurementUnit.findUnique({
      where: { code },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException('Measurement unit code already exists');
    }
  }

  private async ensureBaseRules(
    kind: MeasurementKind,
    isBase: boolean,
    conversionRateToBase: number,
    currentId?: string,
  ) {
    if (!isBase) {
      return;
    }

    if (conversionRateToBase !== 1) {
      throw new BadRequestException(
        'Base measurement units must have conversionRateToBase equal to 1',
      );
    }

    const existingBase = await this.prisma.measurementUnit.findFirst({
      where: {
        isBase: true,
        kind,
      },
    });

    if (existingBase && existingBase.id !== currentId) {
      throw new ConflictException(
        `A base measurement unit already exists for ${kind}`,
      );
    }
  }

  private normalizeCode(code: string) {
    return code.trim().toLowerCase();
  }
}
