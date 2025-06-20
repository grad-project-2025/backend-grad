import { ApiProperty } from '@nestjs/swagger';

export class FareTypeDto {
  @ApiProperty({ description: 'Internal code for the fare type' })
  code: string;

  @ApiProperty({ description: 'Display name for the fare type' })
  name: string;

  @ApiProperty({ description: 'Description of the fare type', required: false })
  description?: string;

  @ApiProperty({ description: 'Price for this fare type' })
  price: number;

  @ApiProperty({ description: 'Currency code' })
  currency: string;

  @ApiProperty({ description: 'Baggage allowance information' })
  baggageAllowance: {
    carryOn: string;
    checked: string;
  };

  @ApiProperty({
    description: 'Features included or excluded with this fare type',
  })
  features: {
    name: string;
    included: boolean;
    description?: string;
  }[];
}
