import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Min, ValidateIf } from 'class-validator';

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

  @ApiPropertyOptional({
    example: 1500,
    description: 'Costo por unidad. Enviar solo si no se indica lineTotal.',
  })
  @ValidateIf((item: PurchaseItemDto) => item.unitCost !== undefined)
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    {
      message:
        'El costo unitario debe ser un numero con hasta cuatro decimales',
    },
  )
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({
    example: 6500,
    description: 'Importe del renglon. Enviar solo si no se indica unitCost.',
  })
  @ValidateIf((item: PurchaseItemDto) => item.lineTotal !== undefined)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El costo total debe ser un numero con hasta dos decimales' },
  )
  @Min(0.01, { message: 'El costo total debe ser de al menos 0.01' })
  lineTotal?: number;
}
