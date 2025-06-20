import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaymentStatus } from '../enums/payment-status.enum';

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  status: PaymentStatus;

  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsString()
  @IsOptional()
  failureCode?: string;

  @IsString()
  @IsOptional()
  failureMessage?: string;

  @IsString()
  @IsOptional()
  refundReason?: string;

  @IsObject()
  @IsOptional()
  providerResponse?: Record<string, any>;
}
