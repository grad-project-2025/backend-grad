import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

// Add index decorator manually
const Index = (spec: any, options?: any) => {
  return (target: any) => {
    SchemaFactory.createForClass(target).index(spec, options);
  };
};

@Schema()
export class Stop {
  @Prop({ required: true })
  airport: string;

  @Prop({ required: true })
  arrivalTime: Date;

  @Prop({ required: true })
  departureTime: Date;

  @Prop({ required: true })
  flightNumber: string;

  @Prop({ required: true })
  carrierCode: string;
}

@Schema({ _id: false })
export class BaggageOption {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  weightInKg: number;

  @Prop({ required: true })
  price: number;

  @Prop({ required: false })
  quantity?: number;
}

@Schema({ _id: false })
export class BaggageOptions {
  @Prop({ required: true })
  included: string;

  @Prop({ required: false })
  cabin: string;

  @Prop({ type: [BaggageOption], default: [] })
  options: BaggageOption[];
}

@Schema({ _id: false })
export class BaggageAllowance {
  @Prop({ required: true })
  carryOn: string;

  @Prop({ required: true })
  checked: string;
}

@Schema({ _id: false })
export class FareFeature {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  included: boolean;

  @Prop({ required: false })
  description?: string;
}

@Schema({ _id: false })
export class FareType {
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: false })
  description?: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ type: BaggageAllowance, required: true })
  baggageAllowance: BaggageAllowance;

  @Prop({ type: [FareFeature], default: [] })
  features: FareFeature[];
}

@Schema({ _id: false })
export class PricingDetail {
  @Prop({ required: true })
  totalPrice: number;

  @Prop({ required: true })
  basePrice: number;

  @Prop({ required: true })
  taxes: number;

  @Prop({ required: true })
  currency: string;

  // Explicitly define the type for the breakdown field
  @Prop({
    type: MongooseSchema.Types.Mixed, // Use Mixed for complex/ambiguous types
    required: true,
  })
  breakdown: Record<string, any>; // Adjust to match your structure
}

@Schema({ timestamps: true, versionKey: 'version' })
@Index(
  { departureAirport: 1, arrivalAirport: 1, departureTime: 1 },
  { background: true },
)
@Index({ airline: 1, price: 1 }, { background: true })
@Index({ 'stops.airport': 1 }, { background: true })
export class Seat {
  @Prop({ required: true })
  seatNumber: string;

  @Prop({
    required: true,
    enum: ['available', 'booked', 'blocked'],
    default: 'available',
  })
  status: string;
}

@Schema({ timestamps: true, versionKey: 'version' })
export class Flight {
  @Prop({ required: true })
  offerId: string;

  @Prop({ required: true })
  flightNumber: string;

  @Prop({ required: true })
  airline: string;

  @Prop({ required: true })
  departureAirport: string;

  @Prop({ required: true })
  arrivalAirport: string;

  @Prop({ required: true })
  departureTime: Date;

  @Prop({ required: true })
  arrivalTime: Date;

  @Prop({ required: true })
  status: string;

  @Prop()
  aircraft?: string;

  @Prop({ required: true })
  price: number;

  @Prop({ type: PricingDetail, required: false })
  pricingDetail?: PricingDetail;

  @Prop({ required: true })
  seatsAvailable: number;

  @Prop({ type: [Stop], default: [] })
  stops: Stop[];

  @Prop({ required: true })
  lastTicketingDate: string;

  @Prop({ type: BaggageOptions, required: true })
  baggageOptions: BaggageOptions;

  @Prop({ type: [FareType], default: [] })
  fareTypes: FareType[];

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({ default: 0 })
  version: number;

  @Prop({ type: [Seat], default: [] })
  seats: Seat[];
}

@Schema({ timestamps: true })
export class SeatHold extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Flight' })
  flightId: Types.ObjectId;

  @Prop({ required: true })
  seats: number;

  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const FlightSchema = SchemaFactory.createForClass(Flight);
export const SeatHoldSchema = SchemaFactory.createForClass(SeatHold);

// Add performance-optimizing indexes
FlightSchema.index({ offerId: 1 }, { unique: true });
FlightSchema.index({ seatsAvailable: 1 });
FlightSchema.index({ price: 1 });
FlightSchema.index({ departureTime: 1 });
FlightSchema.index({ arrivalTime: 1 });
FlightSchema.index({ airline: 1 });
FlightSchema.index({ version: 1 });
FlightSchema.index({
  departureAirport: 1,
  arrivalAirport: 1,
  departureTime: 1,
  price: 1,
});

// Add indexes for seat-hold operations
SeatHoldSchema.index({ expiresAt: 1 });
SeatHoldSchema.index({ sessionId: 1 });
SeatHoldSchema.index({ flightId: 1 });

// Add pre-save hook to validate flightId
SeatHoldSchema.pre('save', async function (next) {
  if (!Types.ObjectId.isValid(this.flightId)) {
    return next(new Error('Invalid flightId: must be a valid ObjectId'));
  }
  const flight = await this.model('Flight').findById(this.flightId);
  if (!flight) {
    return next(new Error(`No flight found for flightId: ${this.flightId}`));
  }
  next();
});
