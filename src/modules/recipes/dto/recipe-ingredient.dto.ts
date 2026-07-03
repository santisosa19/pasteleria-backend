import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class RecipeIngredientDto {
  @ApiProperty({ description: 'Raw material id used by this recipe.' })
  @IsUUID()
  rawMaterialId: string;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity: number;

  @ApiProperty({ description: 'Measurement unit id for this ingredient.' })
  @IsUUID()
  unitId: string;
}
