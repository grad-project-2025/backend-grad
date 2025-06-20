import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Notification } from './schemas/notification.schema';
import { Model } from 'mongoose';
import { NotificationData, NotificationStates } from './notification.model';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
    @Inject('FIREBASE_ADMIN') private readonly firebaseApp: admin.app.App,
  ) {}

  async saveNotification(
    notificationData: NotificationData,
  ): Promise<Notification> {
    const notification = new this.notificationModel(notificationData);
    return await notification.save();
  }

  async getNotificationsCount(topic: string): Promise<{ count: number }> {
    const count = await this.notificationModel
      .countDocuments({ topic, state: NotificationStates.UNREAD })
      .exec();
    return { count };
  }

  async getNotifications(topic: string): Promise<Notification[]> {
    // get data
    const data = await this.notificationModel
      .find({ topic })
      .sort({ createdAt: -1 })
      .exec();

    // update state to read
    await this.notificationModel
      .updateMany(
        { topic, state: NotificationStates.UNREAD },
        { state: NotificationStates.READ },
      )
      .exec();

    // return data;
    return data;
  }

  // send notification to the user using firebase-admin
  async sendNotification(notificationData: NotificationData): Promise<string> {
    const message: admin.messaging.Message = {
      topic: `/topics/${notificationData.topic}`,
      notification: {
        title: notificationData.title,
        body: notificationData.body,
      },
      android: {
        notification: {
          clickAction: '.Activities.CustomerRebateConfirmation',
        },
      },
      data: {
        bookingId: notificationData.bookingId,
      },
    };

    return await this.firebaseApp.messaging().send(message);
  }
}
