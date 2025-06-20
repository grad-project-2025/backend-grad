import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Flight } from '../schemas/flight.schema';
import { IFlightRepository } from './flight.repository.interface';
import { QueryFlightDto } from '../dto/query-flight.dto';
import { FlightAvailabilityQuery } from '../dto/available-flight-query.dto';
import { FlightQueryFilter } from '../dto/query-flight.dto';

@Injectable()
export class FlightRepository implements IFlightRepository {
  constructor(
    @InjectModel('Flight') private readonly flightModel: Model<Flight>,
  ) {}

  async searchFlights(
    query: QueryFlightDto & { skip?: number; limit?: number },
  ): Promise<Flight[]> {
    const startTime = Date.now();
    const filter: FlightQueryFilter = {};
    if (query.departureAirport)
      filter.departureAirport = query.departureAirport;
    if (query.arrivalAirport) filter.arrivalAirport = query.arrivalAirport;
    if (query.departureDate) {
      const date = new Date(query.departureDate);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.departureTime = { $gte: startOfDay, $lte: endOfDay };
    }

    // Add price filters if available
    if (query.minPrice !== undefined) {
      filter.price = filter.price || {};
      filter.price.$gte = query.minPrice;
    }
    if (query.maxPrice !== undefined) {
      filter.price = filter.price || {};
      filter.price.$lte = query.maxPrice;
    }

    // Add airline filter if specified
    if (query.airline) filter.airline = query.airline;

    // Add stops filter
    if (query.maxStops !== undefined) {
      filter['stops.length'] = { $lte: query.maxStops };
    }

    const { skip = 0, limit = 10 } = query;

    // Define sort options
    const sortOptions: Record<string, 1 | -1> = {};
    if (query.sortBy) {
      sortOptions[query.sortBy] = query.sortOrder === 'desc' ? -1 : 1;
    } else {
      // Default sort by price ascending
      sortOptions.price = 1;
    }

    // Only request fields we need using projection for better performance
    return this.flightModel
      .find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean() // Use lean() for better performance when you don't need Mongoose methods
      .exec()
      .then((results) => {
        console.log(`Flight search completed in ${Date.now() - startTime}ms`);
        return results;
      });
  }

  async searchAvailableFlights(
    query: FlightAvailabilityQuery,
  ): Promise<Flight[]> {
    // Add minimum seat availability check and use projection for performance
    const minSeats = query.minSeats || 1;
    const filter = { ...query, seatsAvailable: { $gte: minSeats } };

    return this.flightModel
      .find(filter)
      .lean() // Use lean for performance
      .exec();
  }

  async findById(
    id: string,
    projection?: Record<string, number>,
  ): Promise<Flight | null> {
    // Use projection to limit fields returned for better performance
    return this.flightModel
      .findById(id, projection || {})
      .lean()
      .exec();
  }

  async findByFlightNumber(
    flightNumber: string,
    projection?: Record<string, number>,
  ): Promise<Flight | null> {
    // Use projection to limit fields returned for better performance
    return this.flightModel
      .findOne({ flightNumber }, projection || {})
      .lean()
      .exec();
  }
}
