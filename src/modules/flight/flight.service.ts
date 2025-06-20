import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { I18nService } from 'nestjs-i18n';
import { QueryFlightDto } from './dto/query-flight.dto';
import { FlightSearchService } from './services/flight-search.service';
import { BaggageService } from './services/baggage.service';
import { CacheService } from './services/cache.service';
import { FormattedFlight } from './interfaces/flight-data.interface';
import { BaggageSelectionDto } from './dto/baggage.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Flight } from './schemas/flight.schema';
import { PricingService } from './services/pricing.service';
import { AmadeusService } from './services/amadeus.service';
@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);

  constructor(
    private readonly flightSearchService: FlightSearchService,
    private readonly baggageService: BaggageService,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly pricingService: PricingService,
    private readonly i18n: I18nService,
    private readonly amadeusService: AmadeusService,
    @InjectModel('Flight') private readonly flightModel: Model<Flight>,
  ) {}

  private filterByTimeRange(
    flights: FormattedFlight[],
    timeRange: string,
  ): FormattedFlight[] {
    if (!timeRange) return flights;

    const timeRanges = {
      morning: { start: 6, end: 12 },
      afternoon: { start: 12, end: 18 },
      evening: { start: 18, end: 24 },
      night: { start: 0, end: 6 },
    };

    return flights.filter((flight) => {
      if (!flight.departureTime) return false;
      const departureTime = new Date(flight.departureTime);
      const hour = departureTime.getHours();
      const range = timeRanges[timeRange.toLowerCase()];
      return hour >= range.start && hour < range.end;
    });
  }

  async searchAvailableFlights(
    query: QueryFlightDto,
  ): Promise<{ paginatedFlights: FormattedFlight[]; total: number }> {
    const result = await this.flightSearchService.searchAvailableFlights(query);

    // Apply time range filter if specified
    const filteredFlights = query.departureTimeRange
      ? this.filterByTimeRange(
          result.paginatedFlights,
          query.departureTimeRange,
        )
      : result.paginatedFlights;

    return {
      paginatedFlights: filteredFlights,
      total: filteredFlights.length,
    };
  }

  async setCache(key: string, value: any): Promise<void> {
    await this.cacheService.set(key, value);
  }

  async getCache(key: string): Promise<any> {
    return await this.cacheService.get(key);
  }

  async getAvailableSeats(flightId: string): Promise<number> {
    if (!Types.ObjectId.isValid(flightId)) {
      throw new HttpException(
        'Invalid flight ID format',
        HttpStatus.BAD_REQUEST,
      );
    }

    const flight = await this.flightModel
      .findById(flightId)
      .select('seatsAvailable version')
      .lean();

    if (!flight) {
      throw new HttpException('Flight not found', HttpStatus.NOT_FOUND);
    }

    return flight.seatsAvailable;
  }

  async findOne(id: string): Promise<Flight> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const flight = await this.flightModel.findById(id).lean().exec();
        if (flight) return flight;
      }

      const flight = await this.flightModel
        .findOne({ offerId: id })
        .lean()
        .exec();
      if (!flight) {
        throw new HttpException(
          `Flight with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      return flight;
    } catch (error) {
      this.logger.error(`Error finding flight ${id}: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Error finding flight',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getFlightPricing(
    flightId: string,
  ): Promise<{ basePrice: number; currency: string }> {
    const flight = await this.findOne(flightId);
    return {
      basePrice: Number(flight.price),
      currency: flight.currency || 'USD',
    };
  }

  // Get seat map for a flight offerId (for controller)
  async getSeatMapForFlight(offerId: string): Promise<any> {
    try {
      // Call AmadeusService to get seat map
      // (You may want to cache this in production)
      return await this.amadeusService.getSeatMap(offerId);
    } catch (error) {
      this.logger.error(
        `Error fetching seat map for offerId ${offerId}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to fetch seat map from Amadeus',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
