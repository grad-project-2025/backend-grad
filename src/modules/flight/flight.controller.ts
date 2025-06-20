import {
  Controller,
  Get,
  Post,
  Query,
  Logger,
  HttpException,
  HttpStatus,
  Param,
  Body,
  UseInterceptors,
} from '@nestjs/common';
import { FlightService } from './flight.service';
import { QueryFlightDto } from './dto/query-flight.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponseDto } from './dto/api-response.dto';
import { Throttle } from '@nestjs/throttler';
import { plainToClass } from 'class-transformer';
import {
  FlightResponseDto,
  BaggageOptionsDto,
} from './dto/flight-response.dto';
import { I18nService } from 'nestjs-i18n';
import { QueryTransformInterceptor } from '../../common/interceptors/query-transform.interceptor';

@ApiTags('Flights')
@Controller('flights')
@UseInterceptors(QueryTransformInterceptor)
export class FlightController {
  private readonly logger = new Logger(FlightController.name);

  constructor(
    private readonly flightService: FlightService,
    private readonly i18n: I18nService,
  ) {}

  @Get('search/available')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async searchAvailableFlights(@Query() query: QueryFlightDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 10, 50);

    if (!Number.isInteger(page) || page < 1) {
      throw new HttpException(
        'Page must be a positive integer',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new HttpException(
        'Limit must be a positive integer between 1 and 50',
        HttpStatus.BAD_REQUEST,
      );
    }

    const departureDate = new Date(query.departureDate);
    const currentDate = new Date();
    if (isNaN(departureDate.getTime())) {
      throw new HttpException(
        'departureDate must be a valid date in YYYY-MM-DD format',
        HttpStatus.BAD_REQUEST,
      );
    }

    const departureDateOnly = new Date(
      departureDate.getFullYear(),
      departureDate.getMonth(),
      departureDate.getDate(),
    );
    const currentDateOnly = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
    );
    if (departureDateOnly < currentDateOnly) {
      throw new HttpException(
        'departureDate must be a future date',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { adults, children = 0, infants = 0, language = 'en' } = query;
    const totalPassengers = adults + children + infants;
    if (totalPassengers > 9) {
      throw new HttpException(
        await this.i18n.t('errors.tooManyPassengers', {
          lang: language,
          args: { max: 9 },
        }),
        HttpStatus.BAD_REQUEST,
      );
    }
    if (infants > adults) {
      throw new HttpException(
        await this.i18n.t('errors.tooManyInfants', { lang: language }),
        HttpStatus.BAD_REQUEST,
      );
    }

    const { paginatedFlights, total } =
      await this.flightService.searchAvailableFlights(query);

    const transformedFlights = paginatedFlights.map((flight) => {
      const baggageOptionsRaw =
        (flight.baggageOptions as unknown as Partial<BaggageOptionsDto>) || {};
      const optionsRaw = baggageOptionsRaw?.options ?? [];
      const options = Array.isArray(optionsRaw)
        ? optionsRaw.map((opt: any) => ({
            type: opt?.type ?? 'CHECKED',
            weightInKg: opt?.weightInKg ?? 0,
            price: opt?.price ?? 0,
            quantity: opt?.quantity ?? 1,
          }))
        : [];
      const baggageOptions: BaggageOptionsDto = {
        included: baggageOptionsRaw?.included ?? '1 personal item',
        options,
        source: baggageOptionsRaw?.source ?? 'fallback',
        cabin: baggageOptionsRaw?.cabin ?? '',
      };

      // Simplified pricingDetail
      const pricingDetail = {
        total: flight.totalPrice ?? flight.price ?? 0,
        currency: flight.currency ?? 'USD',
      };

      // Timeline/flight details
      const details = {
        from: flight.departureAirportName || flight.departureAirport,
        to: flight.arrivalAirportName || flight.arrivalAirport,
        departureTime: flight.departureTime,
        arrivalTime: flight.arrivalTime,
        departureDate: flight.departureTime
          ? new Date(flight.departureTime).toISOString().split('T')[0]
          : undefined,
        arrivalDate: flight.arrivalTime
          ? new Date(flight.arrivalTime).toISOString().split('T')[0]
          : undefined,
        numberOfStops:
          flight.numberOfStops ?? (flight.stops ? flight.stops.length : 0),
        airline: flight.airlineName || flight.airline,
        duration: flight.duration,
        baggageOptions,
        fareTypes: Array.isArray(flight.fareTypes)
          ? flight.fareTypes.map((ft: any) => {
              let checked = ft.baggageAllowance?.checked;
              // Normalize checked baggage field based on description
              if (typeof ft.description === 'string') {
                const desc = ft.description.toLowerCase();
                if (desc.includes('2 checked bags')) {
                  checked = '2 checked bags (23kg each)';
                } else if (
                  desc.includes('checked baggage included') ||
                  desc.includes('1 checked bag')
                ) {
                  checked = '1 checked bag (23kg)';
                } else if (
                  desc.includes('no checked baggage') ||
                  desc.includes('no checked bags')
                ) {
                  checked = 'No checked bags';
                }
              }
              return {
                ...ft,
                baggageAllowance: {
                  ...ft.baggageAllowance,
                  checked,
                },
              };
            })
          : flight.fareTypes,
      };

      // Remove original pricingDetail, baggageOptions, fareTypes from root
      const {
        pricingDetail: _oldPricing,
        baggageOptions: _oldBaggage,
        fareTypes: _oldFares,
        ...rest
      } = flight;

      return {
        ...rest,
        pricingDetail,
        details,
        _id: flight._id,
        offerId: flight.offerId, // Amadeus offerId for debugging
      };
    });

    return new ApiResponseDto({
      success: true,
      message: `Found ${paginatedFlights.length} available flight offers (out of ${total} total)`,
      data: {
        flights: transformedFlights,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  }

  // NEW: Get seat map for a flight by flightId
  @Get(':flightId/seatmap')
  async getSeatMap(@Param('flightId') flightId: string) {
    try {
      // Find the flight in the database
      const flight = await this.flightService.findOne(flightId);
      if (!flight?.offerId) {
        throw new HttpException(
          'Flight offerId not found',
          HttpStatus.NOT_FOUND,
        );
      }
      // Call Amadeus SeatMap API
      const seatMap = await this.flightService.getSeatMapForFlight(
        flight.offerId,
      );
      return { success: true, seatMap };
    } catch (error) {
      // Log and return a safe error response
      this.logger.error(
        `Seat map error for flight ${flightId}: ${error.message}`,
      );
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Failed to fetch seat map',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
