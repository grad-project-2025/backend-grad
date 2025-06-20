import { Flight } from '../schemas/flight.schema';
import { QueryFlightDto } from '../dto/query-flight.dto';
import { FlightAvailabilityQuery } from '../dto/available-flight-query.dto';
import { UpdateQuery, FilterQuery, QueryOptions } from 'mongoose';
export const FLIGHT_REPOSITORY = 'FLIGHT_REPOSITORY';

export interface IFlightRepository {
  findById(id: string): Promise<Flight | null>;

  findByFlightNumber(flightNumber: string): Promise<Flight | null>;
  searchFlights(
    query: QueryFlightDto & { skip?: number; limit?: number },
  ): Promise<Flight[]>;
  searchAvailableFlights(query: FlightAvailabilityQuery): Promise<Flight[]>;
}
