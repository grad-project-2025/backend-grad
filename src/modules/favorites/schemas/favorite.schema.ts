import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type FavoritDocument = HydratedDocument<Favorit>;

@Schema({ timestamps: true })
export class Favorit {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'User' })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId })
  flightId: MongooseSchema.Types.ObjectId;
}

export const FavoritSchema = SchemaFactory.createForClass(Favorit);

FavoritSchema.index({ userId: -1 });

FavoritSchema.index({ createdAt: -1 });
