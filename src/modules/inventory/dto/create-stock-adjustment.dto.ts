import { ApiProperty } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const stockAdjustmentTypes = [
  StockMovementType.ADJUSTMENT_IN,
  StockMovementType.ADJUSTMENT_OUT,
] as const;

type StockAdjustmentType = (typeof stockAdjustmentTypes)[number];

export class CreateStockAdjustmentDto {
  @ApiProperty({ description: 'Raw material id.' })
  @IsUUID()
  rawMaterialId: string;

  @ApiProperty({ enum: stockAdjustmentTypes })
  @IsIn(stockAdjustmentTypes)
  type: StockAdjustmentType;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity: number;

  @ApiProperty({ description: 'Measurement unit id used for this adjustment.' })
  @IsUUID()
  unitId: string;

  @ApiProperty({ example: 'Correccion por conteo fisico.' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  note: string;
}
