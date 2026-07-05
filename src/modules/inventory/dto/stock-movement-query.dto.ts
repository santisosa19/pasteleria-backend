import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementSourceType, StockMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class StockMovementQueryDto {
  @ApiPropertyOptional({ description: 'Filter by raw material id.' })
  @IsOptional()
  @IsUUID()
  rawMaterialId?: string;

  @ApiPropertyOptional({ enum: StockMovementType })
  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;

  @ApiPropertyOptional({ enum: StockMovementSourceType })
  @IsOptional()
  @IsEnum(StockMovementSourceType)
  sourceType?: StockMovementSourceType;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-31T23:59:59.999Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ default: 100, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;
}
