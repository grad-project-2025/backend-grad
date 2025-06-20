import { ApiProperty } from '@nestjs/swagger';

export class FlightOffer {
  @ApiProperty()
  id: string;

  @ApiProperty()
  source: string;

  @ApiProperty()
  itineraries: any[];

  @ApiProperty()
  price: { currency: string; total: string };

  @ApiProperty()
  numberOfBookableSeats: number;

  @ApiProperty()
  lastTicketingDate: string;
}

export class FlightOfferSearchResponse extends Array<FlightOffer> {}
