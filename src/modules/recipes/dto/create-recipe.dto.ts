import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RecipeIngredientDto } from './recipe-ingredient.dto';

export class CreateRecipeDto {
  @ApiProperty({ example: 'Bizcochuelo de vainilla', maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ example: 'Base para tortas rellenas.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  yieldQuantity: number;

  @ApiProperty({ description: 'Measurement unit id for recipe yield.' })
  @IsUUID()
  yieldUnitId: string;

  @ApiPropertyOptional({
    example: 'Mezclar secos, incorporar huevos y hornear.',
  })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [RecipeIngredientDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];
}
