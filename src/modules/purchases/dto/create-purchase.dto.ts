import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PurchaseItemDto } from './purchase-item.dto';

export class CreatePurchaseDto {
  @ApiPropertyOptional({ description: 'Supplier id.' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ example: 'FC-A-0001-00001234', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNo?: string;

  @ApiPropertyOptional({ example: '2026-07-05T12:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  purchasedAt?: string;

  @ApiPropertyOptional({ example: 'Compra mensual de secos.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}
