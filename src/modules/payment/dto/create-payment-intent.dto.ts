import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString()
  bookingId: string;

  @IsNumber()
  @Min(0.5) // Minimum amount for Stripe (50 cents)
  amount: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}
