import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiPropertyOptional({ description: 'Order id linked to this payment.' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ default: 'manual', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @ApiPropertyOptional({ example: 'mp-payment-123', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerPaymentId?: string;

  @ApiPropertyOptional({ enum: PaymentStatus, default: PaymentStatus.APPROVED })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiProperty({ example: 12500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: '2026-07-05T12:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  paidAt?: string;

  @ApiPropertyOptional({
    description: 'Provider payload for future integrations.',
  })
  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;
}
