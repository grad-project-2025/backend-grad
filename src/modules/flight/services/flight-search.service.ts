import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AmadeusService } from './amadeus.service';
import { I18nService } from 'nestjs-i18n';
import {
  QueryFlightDto,
  SortBy,
  SortOrder,
  TripType,
  DepartureTimeRange,
} from '../dto/query-flight.dto';
import { FormattedFlight } from '../interfaces/flight-data.interface';
import { FlightFormattingService } from './flight-formatting.service';
import { CacheService } from './cache.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FlightSearchService {
  private readonly logger = new Logger(FlightSearchService.name);
  private readonly CACHE_TTL = 60 * 60; // 1 hour

  constructor(
    private readonly amadeusService: AmadeusService,
    private readonly formattingService: FlightFormattingService,
    private readonly cacheService: CacheService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {}

  private generateCacheKey(query: QueryFlightDto): string {
    const {
      tripType,
      departureAirport,
      arrivalAirport,
      departureDate,
      returnDate,
      adults,
      children = 0,
      infants = 0,
      cabinClass,
      minPrice = 0,
      maxPrice = 9999999,
      airline,
      maxStops,
      departureTimeRange,
      sortBy = SortBy.Price,
      sortOrder = SortOrder.Asc,
      page = 1,
      limit = 10,
    } = query;

    const keyParts = [
      'flight',
      tripType,
      departureAirport,
      arrivalAirport,
      departureDate,
      returnDate || 'none',
      adults,
      children,
      infants,
      cabinClass,
      minPrice,
      maxPrice,
      airline || 'any',
      maxStops !== undefined ? maxStops : 'any',
      departureTimeRange || 'any',
      sortBy,
      sortOrder,
      `page=${page}`,
      `limit=${limit}`,
    ];

    return keyParts.join(':');
  }

  async searchAvailableFlights(
    query: QueryFlightDto,
  ): Promise<{ paginatedFlights: FormattedFlight[]; total: number }> {
    const {
      tripType,
      departureAirport,
      arrivalAirport,
      departureDate,
      returnDate,
      adults,
      children = 0,
      infants = 0,
      cabinClass,
      multiCityLegs,
      language = 'en',
      page = 1,
      limit = 10,
      minPrice,
      maxPrice,
      airline,
      maxStops,
      departureTimeRange,
      sortBy,
      sortOrder,
    } = query;

    // Input validation
    if (
      !departureAirport ||
      !arrivalAirport ||
      !departureDate ||
      !tripType ||
      !adults ||
      !cabinClass
    ) {
      throw new HttpException(
        await this.i18n.t('errors.missingRequiredFields', { lang: language }),
        HttpStatus.BAD_REQUEST,
      );
    }
    if (tripType === TripType.RoundTrip && !returnDate) {
      throw new HttpException(
        await this.i18n.t('errors.returnDateRequired', { lang: language }),
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      tripType === TripType.MultiCity &&
      (!multiCityLegs || multiCityLegs.length === 0)
    ) {
      throw new HttpException(
        await this.i18n.t('errors.multiCityLegsRequired', { lang: language }),
        HttpStatus.BAD_REQUEST,
      );
    }

    const cacheKey = this.generateCacheKey(query);
    const cachedResult = await this.cacheService.get<{
      paginatedFlights: FormattedFlight[];
      total: number;
    }>(cacheKey);
    if (cachedResult) {
      this.logger.log(`Cache hit for ${cacheKey}`);
      return cachedResult;
    }

    // Fetch flights
    let rawFlights: any[] = [];
    try {
      this.logger.log(
        `[FLIGHT_SEARCH] About to call Amadeus API. tripType=${tripType}, departureAirport=${departureAirport}, arrivalAirport=${arrivalAirport}, departureDate=${departureDate}, returnDate=${returnDate}, adults=${adults}, children=${children}, infants=${infants}, cabinClass=${cabinClass}, limit=${limit}`,
      );
      if (tripType === TripType.OneWay) {
        rawFlights = await this.amadeusService.searchFlightOffers(
          departureAirport,
          arrivalAirport,
          departureDate,
          adults,
          children,
          infants,
          cabinClass,
          undefined,
          limit,
        );
      } else if (tripType === TripType.RoundTrip) {
        rawFlights = await this.amadeusService.searchFlightOffers(
          departureAirport,
          arrivalAirport,
          departureDate,
          adults,
          children,
          infants,
          cabinClass,
          returnDate,
          limit,
        );
      } else if (tripType === TripType.MultiCity) {
        this.logger.log(
          `[FLIGHT_SEARCH] Calling Amadeus MultiCity API with legs: ${JSON.stringify(multiCityLegs)}`,
        );
        rawFlights = await this.amadeusService.searchMultiCityFlights(
          multiCityLegs.map((leg) => ({
            origin: leg.departureAirport,
            destination: leg.arrivalAirport,
            departureDate: leg.departureDate,
          })),
          adults,
          children,
          infants,
          cabinClass,
          limit,
        );
      }
      this.logger.log(
        `[FLIGHT_SEARCH] Amadeus API returned ${rawFlights.length} flights for tripType=${tripType}`,
      );
    } catch (error) {
      this.logger.error(
        `[FLIGHT_SEARCH] Error fetching flights from Amadeus: ${error.message || 'Unknown error'}`,
      );

      // Check if we have mock data to use in case of API failure
      const useMockData =
        this.configService.get<string>('USE_MOCK_DATA') === 'true';
      if (useMockData) {
        this.logger.warn(
          '[FLIGHT_SEARCH] Using mock flight data due to API failure (USE_MOCK_DATA=true)',
        );
        // In a real app, you might have mock data here or in a separate file
        // For simplicity, we'll just return empty results
      } else {
        this.logger.warn(
          '[FLIGHT_SEARCH] Not using mock data, returning error to client.',
        );
      }

      throw new HttpException(
        await this.i18n.t('errors.amadeusFetchFailed', {
          lang: language,
          args: { details: error.message || 'Unknown error' },
        }),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (rawFlights.length === 0) return { paginatedFlights: [], total: 0 };

    // Format and filter flights
    const formattedFlights = await this.formattingService.formatFlightResponse(
      rawFlights,
      query,
    );
    const filteredFlights = formattedFlights.filter((flight) => {
      if (minPrice !== undefined && flight.price < minPrice) return false;
      if (maxPrice !== undefined && flight.price > maxPrice) return false;
      if (airline && flight.airline !== airline) return false;
      if (maxStops !== undefined && flight.numberOfStops > maxStops)
        return false;
      if (departureTimeRange) {
        const hour = flight.departureHour;
        switch (departureTimeRange) {
          case DepartureTimeRange.Morning:
            return hour >= 6 && hour < 12;
          case DepartureTimeRange.Afternoon:
            return hour >= 12 && hour < 18;
          case DepartureTimeRange.Evening:
            return hour >= 18 && hour < 21;
          case DepartureTimeRange.Night:
            return hour >= 21 || hour < 6;
        }
      }
      return true;
    });

    // Sort flights
    const effectiveSortBy = sortBy || SortBy.Price;
    const effectiveSortOrder = sortOrder || SortOrder.Asc;
    filteredFlights.sort((a, b) => {
      let comparison = 0;
      if (effectiveSortBy === SortBy.Price) comparison = a.price - b.price;
      else if (effectiveSortBy === SortBy.Duration)
        comparison = a.durationInMinutes - b.durationInMinutes;
      else if (effectiveSortBy === SortBy.Stops)
        comparison = a.numberOfStops - b.numberOfStops;
      else if (effectiveSortBy === 'totalPrice')
        comparison = a.totalPrice - b.totalPrice;
      return effectiveSortOrder === 'desc' ? -comparison : comparison;
    });

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedFlights = filteredFlights.slice(
      startIndex,
      startIndex + limit,
    );
    const result = { paginatedFlights, total: filteredFlights.length };

    // Cache result
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }
}
