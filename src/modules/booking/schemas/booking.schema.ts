import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { BookingType, FlightType, TravelerType } from '../dto/create-booking.dto';

export type BookingDocument = Booking & Document;

@Schema({ _id: false })
export class TravelerInfo {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  birthDate: string;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(TravelerType)
  })
  travelerType: TravelerType;

  @Prop({ required: true })
  nationality: string;

  @Prop({ required: true })
  passportNumber: string;

  @Prop({ required: true })
  issuingCountry: string;

  @Prop({ required: true })
  expiryDate: string;

  // Seat assignment fields
  @Prop({ type: String })
  seatNumber?: string;

  @Prop({ type: Date })
  seatAssignedAt?: Date;
}

@Schema({ _id: false })
export class FlightData {
  @Prop({ required: true, type: String })
  flightID: string;

  @Prop({ required: true, type: String, enum: ['GO', 'RETURN'] })
  typeOfFlight: FlightType;

  @Prop({ type: Number })
  numberOfStops?: number;

  @Prop({ required: true })
  originAirportCode: string;

  @Prop({ required: true })
  destinationAirportCode: string;

  @Prop({ required: true })
  originCIty: string;

  @Prop({ required: true })
  destinationCIty: string;

  @Prop({ required: true, type: Date })
  departureDate: Date;

  @Prop({ required: true, type: Date })
  arrivalDate: Date;

  @Prop({ type: Object })
  selectedBaggageOption?: Record<string, any>;
}

@Schema({
  timestamps: true,
})
export class Booking {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'User' })
  userId: MongooseSchema.Types.ObjectId;

  // Booking type - determines if it's one-way or round-trip
  @Prop({
    type: String,
    enum: ['ONE_WAY', 'ROUND_TRIP'],
    default: 'ONE_WAY'
  })
  bookingType: BookingType;

  // For round-trip bookings, store flight data array
  @Prop({ type: [FlightData] })
  flightData?: FlightData[];

  // Legacy fields for one-way bookings (backward compatibility)
  @Prop({ type: String })
  flightId?: string;

  @Prop({ type: String })
  originAirportCode?: string;

  @Prop({ type: String })
  destinationAirportCode?: string;

  @Prop({ type: String })
  originCity?: string;

  @Prop({ type: String })
  destinationCity?: string;

  @Prop({ type: Date })
  departureDate?: Date;

  @Prop({ type: Date })
  arrivalDate?: Date;

  @Prop({ type: Object })
  selectedBaggageOption?: Record<string, any>;

  @Prop({ required: true, type: Number })
  totalPrice: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ type: [TravelerInfo], required: true })
  travellersInfo: TravelerInfo[];

  @Prop({ type: Object, required: true })
  contactDetails: {
    email: string;
    phone: string;
  };

  @Prop({ required: true, unique: true })
  bookingRef: string;

  @Prop({ default: 'pending', enum: ['pending', 'confirmed', 'cancelled'] })
  status: string;

  @Prop({
    default: 'pending',
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
  })
  paymentStatus: string;

  @Prop({ type: String })
  paymentIntentId?: string;

  @Prop({ type: String })
  stripeCustomerId?: string;

  @Prop({ type: Date })
  paymentCompletedAt?: Date;

  @Prop({ type: String })
  cancellationReason?: string;

  @Prop({ type: Date })
  cancelledAt?: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
