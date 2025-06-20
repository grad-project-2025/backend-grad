// query-flight.dto.ts
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  IsDateString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsIataCode } from 'src/common/validators/is-iata-code.validator';

export enum TripType {
  OneWay = 'oneway',
  RoundTrip = 'roundtrip',
  MultiCity = 'multicity',
}

export enum CabinClass {
  Economy = 'ECONOMY',
  PremiumEconomy = 'PREMIUM_ECONOMY',
  Business = 'BUSINESS',
  First = 'FIRST',
}

export enum DepartureTimeRange {
  Morning = 'morning',
  Afternoon = 'afternoon',
  Evening = 'evening',
  Night = 'night',
}

export enum SortBy {
  Price = 'price',
  Duration = 'duration',
  Stops = 'stops',
  TotalPrice = 'totalPrice',
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

// Interface used for MongoDB flight queries
export interface FlightQueryFilter {
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: { $gte?: Date; $lte?: Date };
  arrivalTime?: { $gte?: Date; $lte?: Date };
  price?: { $gte?: number; $lte?: number };
  airline?: string;
  'stops.length'?: { $lte?: number };
  offerId?: string;
  seatsAvailable?: { $gte?: number };
  [key: string]: any;
}

export class MultiCityLeg {
  @IsString()
  @IsIataCode()
  departureAirport: string;

  @IsString()
  @IsIataCode()
  arrivalAirport: string;

  @IsDateString()
  departureDate: string;
}

export class QueryFlightDto {
  @IsEnum(TripType)
  tripType: TripType;

  @IsString()
  @IsIataCode()
  departureAirport: string;

  @IsString()
  @IsIataCode()
  arrivalAirport: string;

  @IsDateString()
  departureDate: string;

  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @IsNumber()
  @Min(1, { message: 'adults must be at least 1' })
  adults: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'children cannot be negative' })
  children?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'infants cannot be negative' })
  infants?: number;

  @IsEnum(CabinClass, {
    message:
      'cabinClass must be one of: ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST',
  })
  cabinClass: CabinClass;

  @IsOptional()
  @IsArray()
  multiCityLegs?: MultiCityLeg[];

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'minPrice cannot be negative' })
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'maxPrice cannot be negative' })
  @ValidateIf((o: any) => o.minPrice !== undefined)
  @Min(0, { message: 'maxPrice must be greater than or equal to minPrice' })
  maxPrice?: number;

  @IsOptional()
  @IsString()
  airline?: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'maxStops cannot be negative' })
  maxStops?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEnum(DepartureTimeRange, {
    message:
      'departureTimeRange must be one of: morning, afternoon, evening, night',
  })
  departureTimeRange?: DepartureTimeRange;

  @IsOptional()
  @IsEnum(SortBy, {
    message: 'sortBy must be one of: price, duration, stops, totalPrice',
  })
  sortBy?: SortBy;

  @IsOptional()
  @IsEnum(SortOrder, { message: 'sortOrder must be one of: asc, desc' })
  sortOrder?: SortOrder;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'page must be at least 1' })
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'limit must be at least 1' })
  limit?: number;

  @IsOptional()
  @IsString()
  language?: string;
}
