import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export type PaymentDocument = Payment & Document;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Payment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Booking', required: true })
  bookingId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, default: 'EGP' })
  currency: string;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
    index: true,
  })
  status: PaymentStatus;

  @Prop({
    type: String,
    enum: Object.values(PaymentProvider),
    required: true,
    index: true,
  })
  provider: PaymentProvider;

  @Prop({
    type: String,
    enum: Object.values(PaymentMethod),
    required: true,
  })
  method: PaymentMethod;

  @Prop({ type: String })
  transactionId?: string;

  @Prop({ type: String })
  paymentKey?: string;

  @Prop({ type: String })
  receiptUrl?: string;

  @Prop({ type: Object })
  providerResponse?: Record<string, any>;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: Date })
  refundedAt?: Date;

  @Prop({ type: String })
  refundReason?: string;

  @Prop({ type: String })
  failureCode?: string;

  @Prop({ type: String })
  failureMessage?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ type: Boolean, default: false })
  isTest: boolean;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// Indexes for better query performance
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ bookingId: 1 }, { unique: true }); // Assuming one payment per booking
PaymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ 'metadata.orderReference': 1 }, { sparse: true });
PaymentSchema.index({ createdAt: -1 }); // For recent payments query
