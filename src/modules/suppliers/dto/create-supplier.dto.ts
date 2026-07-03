import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Distribuidora Dulce Sur', maxLength: 180 })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name: string;

  @ApiPropertyOptional({ example: '30-12345678-9', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  taxId?: string;

  @ApiPropertyOptional({ example: 'ventas@dulcesur.com', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+54 11 5555-5555', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  phone?: string;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 123', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 'Entrega los martes por la mañana.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
