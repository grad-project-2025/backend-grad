export interface PricingDetail {
  summary: {
    totalPrice: number;
    currency: string;
    priceGuaranteedUntil: string;
  };
  breakdown: {
    passengers: {
      type: 'ADT' | 'CHD' | 'INF';
      count: number;
      priceEach: number;
      subtotal: number;
      description?: string;
    }[];
    fees: {
      name: string;
      amount: number;
    }[];
  };
}
export interface BaggageOptionDto {
  type: 'CARRY_ON' | 'CHECKED' | 'PERSONAL_ITEM';
  quantity: number;
  price: string;
  description: string;
  weight: number;
}

export interface BaggageOptions {
  included: string;
  cabin?: string;
  options: BaggageOptionDto[];
}

// Import the FareTypeDto for the FormattedFlight interface
import { FareTypeDto } from '../dto/fare-type.dto';

export interface SeatInfo {
  seatNumber: string;
  status: 'available' | 'booked' | 'blocked';
}

export interface FormattedFlight {
  _id: any;
  offerId: string;
  flightNumber: string;
  airline: string;
  airlineName: string;
  departureAirport: string;
  departureAirportName: string;
  departureTime: Date;
  departureTimeLocal: string;
  arrivalAirport: string;
  arrivalAirportName: string;
  arrivalTime: Date;
  arrivalTimeLocal: string;
  status: string;
  aircraft?: string;
  price: number;
  pricingDetail: PricingDetail;
  currency: string;
  totalPrice?: number;
  seatsAvailable: number;
  stops: Array<{
    airport: string;
    bookable: boolean;
    airportName: string;
    arrivalTime: Date;
    departureTime: Date;
    flightNumber: string;
    carrierCode: string;
    layoverDuration?: string;
    layoverDurationInMinutes?: number;
  }>;
  lastTicketingDate: string;
  baggageOptions: BaggageOptions;
  fareTypes: FareTypeDto[];
  duration: string;
  durationInMinutes: number;
  numberOfStops: number;
  isRecommended: boolean;
  departureHour: number;
  createdAt: Date;
  updatedAt: Date;
  sessionId?: string;
  seats: SeatInfo[];
}

export const AIRLINE_MAP: { [key: string]: { en: string; ar: string } } = {
  F9: { en: 'Frontier Airlines', ar: 'فرونتير ايرلاينز' },
  AA: { en: 'American Airlines', ar: 'الخطوط الجوية الأمريكية' },
  DL: { en: 'Delta Air Lines', ar: 'خطوط دلتا الجوية' },
  UA: { en: 'United Airlines', ar: 'الخطوط الجوية المتحدة' },
  SV: { en: 'Saudia', ar: 'السعودية' },
  NE: { en: 'Nesma Airlines', ar: 'طيران ناسما' },
  MS: { en: 'EgyptAir', ar: 'مصر للطيران' },
  XY: { en: 'Flynas', ar: 'فلاي ناس' },
  TK: { en: 'Turkish Airlines', ar: 'الخطوط الجوية التركية' },
  ET: { en: 'Ethiopian Airlines', ar: 'الخطوط الجوية الإثيوبية' },
};

export const AIRPORT_MAP: { [key: string]: { en: string; ar: string } } = {
  CAI: { en: 'Cairo International Airport', ar: 'مطار القاهرة الدولي' },
  JED: {
    en: 'King Abdulaziz International Airport',
    ar: 'مطار الملك عبدالعزيز الدولي',
  },
  IST: { en: 'Istanbul Airport', ar: 'مطار إسطنبول' },
  ADD: {
    en: 'Addis Ababa Bole International Airport',
    ar: 'مطار أديس أبابا بولي الدولي',
  },
  DMM: { en: 'King Fahd International Airport', ar: 'مطار الملك فهد الدولي' },
};

export const AIRPORT_TIMEZONES: { [key: string]: string } = {
  CAI: 'Africa/Cairo',
  JED: 'Asia/Riyadh',
};

export const EXCHANGE_RATES: { [key: string]: number } = {
  USD_TO_EGP: 48.5,
  USD_TO_SAR: 3.75,
};
