import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelBookingDto {
  @ApiProperty({
    example: 'Change of plans',
    description: 'Reason for cancelling the booking',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
} 