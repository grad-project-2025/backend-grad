import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ type: [String], default: ['user'] })
  roles: string[];

  @Prop({ unique: false })
  phoneNumber?: string;

  @Prop({ required: false })
  country?: string;

  @Prop({ type: Date, required: false })
  birthdate?: Date;

  @Prop({ default: false })
  isVerified?: boolean;

  @Prop()
  verificationToken?: string;

  @Prop({ type: Date })
  verificationTokenExpiry?: Date;

  @Prop()
  resetToken?: string;

  @Prop({ type: Date })
  resetTokenExpiry?: Date;

  @Prop()
  resetCode?: string;

  @Prop({ type: Date })
  resetCodeExpiry?: Date;

  @Prop()
  refreshToken?: string;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;

  @Prop()
  gender?: string;

  @Prop()
  preferredLanguage?: string;

  @Prop({ type: [String] })
  preferredAirlines?: string[];

  @Prop()
  deviceType?: string;

  @Prop({ type: { status: String, points: Number } })
  loyaltyProgram?: {
    status: string;
    points: number;
  };

  @Prop({
    type: [
      {
        airline: String,
        date: Date,
        cabinClass: {
          type: String,
          enum: ['economy', 'premium', 'business', 'first'],
        },
      },
    ],
  })
  bookingHistory?: Array<{
    airline: string;
    date: Date;
    cabinClass: string;
  }>;

  @Prop({ enum: ['economy', 'premium', 'business', 'first'] })
  preferredCabinClass?: string;

  @Prop({ default: false })
  useRecommendationSystem?: boolean;
}

export type UserDocument = User & Document & { _id: Types.ObjectId };
export const UserSchema = SchemaFactory.createForClass(User);
