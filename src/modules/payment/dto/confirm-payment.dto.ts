import { IsString, IsOptional } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  paymentIntentId: string;

  @IsString()
  bookingId: string;

  // Add optional field for user email (backend will set it, not required from frontend)
  @IsOptional()
  @IsString()
  userEmail?: string;
}
