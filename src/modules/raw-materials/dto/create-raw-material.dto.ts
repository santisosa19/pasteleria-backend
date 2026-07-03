import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRawMaterialDto {
  @ApiProperty({ example: 'Harina 0000', maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ example: 'Bolsa de harina para pasteleria.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Base measurement unit id for this material.' })
  @IsUUID()
  baseUnitId: string;

  @ApiPropertyOptional({ default: 0, example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  currentStock?: number;

  @ApiPropertyOptional({ default: 0, example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  minimumStock?: number;

  @ApiPropertyOptional({ default: 0, example: 1.25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  averageCost?: number;

  @ApiPropertyOptional({ example: 1.4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  lastPurchaseCost?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
