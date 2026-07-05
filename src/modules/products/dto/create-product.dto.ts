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

export class CreateProductDto {
  @ApiProperty({ example: 'Torta brownie', maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ example: 'Brownie con dulce de leche y merengue.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'TORTA-BROWNIE-20', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @ApiPropertyOptional({ description: 'Recipe id used to estimate cost.' })
  @IsOptional()
  @IsUUID()
  recipeId?: string;

  @ApiProperty({ example: 12500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
