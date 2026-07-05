import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class PurchaseItemDto {
  @ApiProperty({ description: 'Raw material id.' })
  @IsUUID()
  rawMaterialId: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity: number;

  @ApiProperty({ description: 'Measurement unit id used in this purchase.' })
  @IsUUID()
  unitId: string;

  @ApiProperty({ example: 1500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitCost: number;
}
