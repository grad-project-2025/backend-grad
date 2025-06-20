import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { FareTypeDto } from './fare-type.dto';

export enum FlightStatus {}
// Add your flight status values here

export class BaggageOptionItemDto {
  @Expose()
  @ApiProperty({ example: 'CHECKED' })
  type: string;

  @Expose()
  @ApiProperty({ example: 23 })
  weightInKg: number;

  @Expose()
  @ApiProperty({ example: 1530.9 })
  price: number;

  @Expose()
  @ApiProperty({ example: 1 })
  quantity: number;
}

export class BaggageOptionsDto {
  @Expose()
  @ApiProperty({ example: '30kg total checked baggage\n1 piece' })
  included: string;

  @Expose()
  @ApiProperty({ example: '7 kg cabin baggage\n1 piece' })
  cabin: string;

  @Expose()
  @ApiProperty({ type: [BaggageOptionItemDto] })
  options: BaggageOptionItemDto[];

  @Expose()
  @ApiProperty({
    enum: ['amadeus', 'fallback'],
    example: 'fallback',
    description: 'Source of baggage data',
  })
  source: 'amadeus' | 'fallback';
}

export class FlightResponseDto {
  @Expose()
  @ApiProperty({ example: '6803fbee5815daa3adf959c1' })
  _id: string;

  @Expose()
  @ApiProperty({ example: '1' })
  offerId: string;

  @Expose()
  @ApiProperty({ example: 'NE' })
  airline: string;

  @Expose()
  @ApiProperty({ example: '174' })
  flightNumber: string;

  @Expose()
  @ApiProperty({ example: '320' })
  aircraft: string;

  @Expose()
  @ApiProperty({ example: 'CAI' })
  departureAirport: string;

  @Expose()
  @ApiProperty({ example: '2025-05-20T15:25:00.000Z' })
  departureTime: Date;

  @Expose()
  @ApiProperty({ example: 'JED' })
  arrivalAirport: string;

  @Expose()
  @ApiProperty({ example: '2025-05-20T17:40:00.000Z' })
  arrivalTime: Date;

  @Expose()
  @ApiProperty({ example: 5118.13 })
  price: number;

  @Expose()
  @ApiProperty({ example: 'EGP' })
  currency: string;

  @Expose()
  @ApiProperty({ example: 9 })
  seatsAvailable: number;

  @Expose()
  @ApiProperty({ enum: FlightStatus })
  status: string;

  @Expose()
  @ApiProperty({ type: [String], example: [] })
  stops: string[];

  @Expose()
  @ApiProperty({ example: '2025-05-20' })
  lastTicketingDate: string;

  @Expose()
  @ApiProperty({ type: BaggageOptionsDto })
  baggageOptions: BaggageOptionsDto;

  @Expose()
  @ApiProperty({ example: '2025-04-19T19:39:26.301Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2025-04-19T19:44:09.777Z' })
  updatedAt: Date;

  @Expose()
  @ApiProperty({
    type: [FareTypeDto],
    description: 'Available fare types for this flight',
  })
  fareTypes: FareTypeDto[];
}
