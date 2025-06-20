import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { QueryFlightDto } from '../dto/query-flight.dto';
import {
  FormattedFlight,
  AIRLINE_MAP,
  AIRPORT_MAP,
  AIRPORT_TIMEZONES,
} from '../interfaces/flight-data.interface';
import { FlightStatusService } from './flight-status.service';
import { ExchangeRateService } from './exchange-rate.service';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Flight } from '../schemas/flight.schema';
import { PricingService } from './pricing.service';
import { FareTypeDto } from '../dto/fare-type.dto';

@Injectable()
export class FlightFormattingService {
  private readonly logger = new Logger(FlightFormattingService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly flightStatusService: FlightStatusService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly pricingService: PricingService,
    @InjectModel('Flight') private readonly flightModel: Model<Flight>,
  ) {}

  async formatFlightResponse(
    flights: any[],
    query: QueryFlightDto,
  ): Promise<FormattedFlight[]> {
    const {
      adults,
      children = 0,
      infants = 0,
      departureAirport,
      arrivalAirport,
      language = 'en',
    } = query;
    const totalPassengers = adults + children + infants;

    if (flights.length > 0) {
      this.logger.warn(
        '[DEBUG] First Amadeus flight object:',
        JSON.stringify(flights[0], null, 2),
      );
    }

    const filteredFlights = flights.filter((flight) => {
      const segments = flight.itineraries?.[0]?.segments || [];
      const firstSegment = segments[0] || {};
      const lastSegment = segments[segments.length - 1] || {};
      const flightDepartureDate = firstSegment.departure?.at
        ? new Date(firstSegment.departure.at).toISOString().split('T')[0]
        : '';
      const seatsAvailable = flight.numberOfBookableSeats || 0;
      return (
        flightDepartureDate === query.departureDate &&
        seatsAvailable >= totalPassengers
      );
    });

    // Process each filtered flight
    return Promise.all(
      filteredFlights.map(async (flight) => {
        const segments = flight.itineraries?.[0]?.segments || [];
        const firstSegment = segments[0] || {};
        const lastSegment = segments[segments.length - 1] || {};

        // Extract departure and arrival times
        const departure = new Date(firstSegment.departure?.at || new Date());
        const arrival = new Date(lastSegment.arrival?.at || new Date());

        // Keep original price and currency from Amadeus
        const price = parseFloat(flight.price.total);
        const currency = flight.price.currency || 'USD';

        // Process stops information
        const stops =
          segments.length > 1
            ? segments.slice(0, -1).map((segment, index) => {
                const nextSegment = segments[index + 1];
                const layoverMs =
                  nextSegment.departure?.at && segment.arrival?.at
                    ? new Date(nextSegment.departure.at).getTime() -
                      new Date(segment.arrival.at).getTime()
                    : 0;

                const layoverHours = Math.floor(layoverMs / (1000 * 60 * 60));
                const layoverMinutes = Math.floor(
                  (layoverMs % (1000 * 60 * 60)) / (1000 * 60),
                );

                let layoverDuration: string | undefined;
                try {
                  layoverDuration =
                    layoverHours || layoverMinutes
                      ? this.i18n.t('duration.format', {
                          lang: language,
                          args: {
                            hours: layoverHours,
                            minutes: layoverMinutes,
                          },
                        })
                      : undefined;
                } catch (error) {
                  this.logger.error(
                    `Failed to translate layover duration: ${(error as Error).message}`,
                  );
                  layoverDuration = `${layoverHours}h ${layoverMinutes}m`;
                }

                return {
                  airport: segment.arrival?.iataCode || '',
                  arrivalTime: segment.arrival?.at
                    ? new Date(segment.arrival.at)
                    : new Date(),
                  departureTime: nextSegment.departure?.at
                    ? new Date(nextSegment.departure.at)
                    : new Date(),
                  flightNumber:
                    segment.number ||
                    `${segment.carrierCode}${segment.number || ''}`,
                  carrierCode: segment.carrierCode || '',
                  layoverDuration,
                };
              })
            : [];

        const baggageOptions = this.extractBaggageOptions(
          flight.travelerPricings || [],
        );
        const fareTypes = this.extractFareTypes(flight.travelerPricings || []);

        const resolvedOfferId = flight.id;
        const pricingDetail = this.pricingService.calculateTotalPrice(
          {
            ...flight,
            price,
            currency,
            carrierCode: firstSegment.carrierCode || flight.airline || '',
          },
          { adults, children, infants },
        );

        // Update flight in database
        await this.flightModel.updateOne(
          { offerId: resolvedOfferId },
          {
            $set: {
              offerId: resolvedOfferId,
              flightNumber: firstSegment.number || '',
              airline: firstSegment.carrierCode || '',
              departureAirport: firstSegment.departure?.iataCode || '',
              arrivalAirport: lastSegment.arrival?.iataCode || '',
              departureTime: departure,
              arrivalTime: arrival,
              status: 'Scheduled',
              price,
              currency,
              seatsAvailable: flight.numberOfBookableSeats || 9,
              stops,
              lastTicketingDate: flight.lastTicketingDate,
              baggageOptions,
              pricingDetail,
              fareTypes,
            },
          },
          { upsert: true },
        );

        const dbFlight = await this.flightModel.findOneAndUpdate(
          { offerId: resolvedOfferId },
          { $set: { lastChecked: new Date() } },
          { new: true, lean: true },
        );

        return this.formatFlight(
          {
            ...dbFlight,
            offerId: resolvedOfferId,
            pricingDetail: dbFlight.pricingDetail || pricingDetail,
            fareTypes: dbFlight.fareTypes || fareTypes,
          },
          language,
        );
      }),
    );
  }

  private formatFlight(flight: any, language: string): FormattedFlight {
    // Calculate totalPrice safely
    const totalPrice =
      flight.pricingDetail?.summary?.totalPrice ||
      flight.price *
        (flight.pricingDetail?.breakdown?.passengers?.reduce(
          (sum, p) => sum + p.count,
          0,
        ) || 1);

    return {
      _id: flight._id,
      offerId: flight.offerId, // Always Amadeus offerId from DB or upsert
      airline: flight.airline,
      airlineName:
        AIRLINE_MAP[flight.airline]?.[language === 'ar' ? 'ar' : 'en'] ||
        flight.airline,
      flightNumber: flight.flightNumber,
      departureAirport: flight.departureAirport,
      seats: flight.seats || [],
      departureAirportName:
        AIRPORT_MAP[flight.departureAirport]?.[
          language === 'ar' ? 'ar' : 'en'
        ] || flight.departureAirport,
      departureTime: flight.departureTime,
      departureTimeLocal: new Date(flight.departureTime).toLocaleTimeString(
        language === 'ar' ? 'ar-EG' : 'en-US',
        { timeZone: AIRPORT_TIMEZONES[flight.departureAirport] || 'UTC' },
      ),
      arrivalAirport: flight.arrivalAirport,
      arrivalAirportName:
        AIRPORT_MAP[flight.arrivalAirport]?.[language === 'ar' ? 'ar' : 'en'] ||
        flight.arrivalAirport,
      arrivalTime: flight.arrivalTime,
      arrivalTimeLocal: new Date(flight.arrivalTime).toLocaleTimeString(
        language === 'ar' ? 'ar-EG' : 'en-US',
        {
          timeZone: AIRPORT_TIMEZONES[flight.arrivalAirport] || 'UTC',
        },
      ),
      status: flight.status || 'Scheduled',
      price: flight.price,
      totalPrice,
      currency: flight.currency,
      seatsAvailable: flight.seatsAvailable,
      stops: flight.stops || [],
      lastTicketingDate: flight.lastTicketingDate,
      baggageOptions: flight.baggageOptions || {
        included: '30kg total checked baggage\n1 piece',
        cabin: '7 kg cabin baggage\n1 piece',
        options: [],
      },
      pricingDetail: flight.pricingDetail || {
        summary: {
          totalPrice,
          currency: flight.currency,
          priceGuaranteedUntil: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        breakdown: {
          passengers: [
            {
              type: 'ADT',
              count: 1,
              priceEach: flight.price,
              subtotal: flight.price,
              description: 'Adult',
            },
          ],
          fees: [],
        },
      },
      fareTypes: flight.fareTypes || [],
      duration: this.calculateDuration(
        flight.departureTime,
        flight.arrivalTime,
      ),
      durationInMinutes: this.calculateDurationMinutes(
        flight.departureTime,
        flight.arrivalTime,
      ),
      numberOfStops: flight.stops?.length || 0,
      isRecommended: flight.price < 350 && (flight.stops?.length || 0) === 0,
      departureHour: new Date(flight.departureTime).getHours(),
      createdAt: flight.createdAt,
      updatedAt: flight.updatedAt,
    };
  }

  private calculateDuration(departure: Date, arrival: Date): string {
    const diff = new Date(arrival).getTime() - new Date(departure).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  private calculateDurationMinutes(departure: Date, arrival: Date): number {
    return Math.round(
      (new Date(arrival).getTime() - new Date(departure).getTime()) /
        (1000 * 60),
    );
  }

  private extractBaggageOptions(travelerPricings: any[]): {
    included: string;
    options: {
      type: string;
      weightInKg: number;
      price: number;
      currency: string;
      quantity: number;
    }[];
    source: 'amadeus' | 'fallback';
    cabin: string;
  } {
    const firstSegment = travelerPricings[0]?.fareDetailsBySegment?.[0];

    // Extract included baggage
    const includedChecked = firstSegment?.includedCheckedBags;
    const includedText = includedChecked
      ? `${includedChecked.quantity || 1} checked bag${
          includedChecked.quantity > 1 ? 's' : ''
        }`
      : '30kg checked baggage';

    // Extract purchasable options from additionalServices
    const options = [];
    if (travelerPricings[0].additionalServices) {
      travelerPricings[0].additionalServices.forEach((service) => {
        if (service.type === 'CHECKED_BAGS') {
          options.push({
            type: 'CHECKED',
            weightInKg: service.weight || 23, // Default to 23kg if not specified
            price: service.amount,
            currency: travelerPricings[0].price.currency,
            quantity: service.quantity || 1,
          });
        }
      });
    }

    return {
      included: includedText,
      options,
      source: firstSegment ? 'amadeus' : 'fallback',
      cabin: firstSegment?.includedCabinBags
        ? `${firstSegment.includedCabinBags.quantity} cabin bag${
            firstSegment.includedCabinBags.quantity > 1 ? 's' : ''
          }`
        : '7 kg cabin baggage',
    };
  }

  private extractFareTypes(travelerPricings: any[]): FareTypeDto[] {
    const fareTypes = new Map<string, FareTypeDto>();

    travelerPricings.forEach((traveler) => {
      traveler.fareDetailsBySegment?.forEach((segment) => {
        const fareKey = segment.brandedFare || segment.fareBasis;

        if (!fareTypes.has(fareKey)) {
          fareTypes.set(fareKey, {
            code: segment.brandedFare || segment.fareBasis,
            name: segment.brandedFareLabel || 'Standard',
            description: '',
            price: traveler.price.total,
            currency: traveler.price.currency,
            baggageAllowance: {
              carryOn: segment.includedCabinBags
                ? `${segment.includedCabinBags.quantity} cabin bag${
                    segment.includedCabinBags.quantity > 1 ? 's' : ''
                  }`
                : '7 kg cabin baggage',
              checked: segment.includedCheckedBags
                ? `${segment.includedCheckedBags.quantity} checked bag${
                    segment.includedCheckedBags.quantity > 1 ? 's' : ''
                  }`
                : 'No checked bags',
            },
            features: [],
          });
        }

        // Add unique amenities as features
        segment.amenities?.forEach((amenity) => {
          const featureName = amenity.description
            .replace(/\d+ PERCENT /i, '')
            .replace(/\d+PC /i, '')
            .replace(/\d+KG/i, '')
            .trim();

          if (
            !fareTypes.get(fareKey).features.some((f) => f.name === featureName)
          ) {
            fareTypes.get(fareKey).features.push({
              name: featureName,
              included: !amenity.isChargeable,
              description: amenity.isChargeable ? 'Fee applies' : 'Included',
            });
          }
        });
      });
    });

    return Array.from(fareTypes.values());
  }

  // Rest of the code remains the same
}
