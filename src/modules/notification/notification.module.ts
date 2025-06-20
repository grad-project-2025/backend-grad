import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  exports: ['FIREBASE_ADMIN'],
  providers: [
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: () => {
        const serviceAccountPath = path.resolve(
          process.cwd(),
          'src/modules/notification/firebase.json',
        );
        const serviceAccount = JSON.parse(
          fs.readFileSync(serviceAccountPath, 'utf-8'),
        );
        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      },
    },
    NotificationService,
  ],
  controllers: [NotificationController],
})
export class NotificationModule {}
