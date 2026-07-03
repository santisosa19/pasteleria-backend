import { ApiProperty } from '@nestjs/swagger';
import { MeasurementKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMeasurementUnitDto {
  @ApiProperty({ example: 'kg', maxLength: 20 })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Kilogramo', maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @ApiProperty({ enum: MeasurementKind, example: MeasurementKind.MASS })
  @IsEnum(MeasurementKind)
  kind: MeasurementKind;

  @ApiProperty({
    description: 'Conversion rate from this unit to the base unit of its kind.',
    example: 1000,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsPositive()
  conversionRateToBase: number;

  @ApiProperty({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  isBase?: boolean;
}
