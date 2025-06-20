import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePaymobPaymentDto {
  @IsMongoId()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsOptional()
  mobileNumber?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

export class PaymobPaymentResponseDto {
  paymentKey: string;
  integrationId: string;
  orderId: number;
  amountCents: number;
  currency: string;
  success: boolean;
  expiresAt: Date;
  merchantOrderId: string;
}
