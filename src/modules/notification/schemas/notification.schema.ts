import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { NotificationStates } from '../notification.model';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: String, required: true })
  topic: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({
    type: Number,
    enum: NotificationStates,
    default: NotificationStates.UNREAD,
  })
  state: NotificationStates;

  @Prop({ type: String, ref: 'booking', required: true })
  bookingId: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ topic: -1 });
NotificationSchema.index({ topic: -1, state: -1 });

// to delete the document after 30 days
NotificationSchema.index({ createdAt: -1 }, { expires: '30d' });
