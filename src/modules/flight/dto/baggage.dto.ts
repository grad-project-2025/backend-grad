import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Min } from 'class-validator';

export class BaggageSelectionDto {
  @ApiProperty({ enum: ['CARRY_ON', 'CHECKED', 'PERSONAL_ITEM'] })
  @IsIn(['CARRY_ON', 'CHECKED', 'PERSONAL_ITEM'])
  type: 'CARRY_ON' | 'CHECKED' | 'PERSONAL_ITEM';

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number = 1;
}

export interface BaggageOptionDto {
  type: 'CARRY_ON' | 'CHECKED' | 'PERSONAL_ITEM';
  quantity: number;
  price: string;
  description: string;
}

export interface BaggageFeeResult {
  total: number;
  breakdown: Array<{
    type: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}
