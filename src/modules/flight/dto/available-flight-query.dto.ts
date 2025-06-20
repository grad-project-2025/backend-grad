import { QueryFlightDto } from './query-flight.dto';

export interface FlightAvailabilityQuery
  extends Omit<QueryFlightDto, 'departureDate'> {
  seatsAvailable: { $gt: number };
  departureTime?: {
    $gte?: Date;
    $lte?: Date;
  };
  // Added to support optimized query with minimum seats
  minSeats?: number;
}
