import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelSaleDto {
  @ApiPropertyOptional({ example: 'Error de carga en la venta.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
