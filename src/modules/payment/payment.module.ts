import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { PaymentService } from './services/payment.service';
import { PaymobService } from './services/paymob.service';
import { PaymentTransactionService } from './services/payment-transaction.service';
import { PaymentController } from './controllers/payment.controller';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    AuthModule,
    UsersModule,
    EmailModule,
    BookingModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: await configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PaymobService, PaymentTransactionService],
  exports: [PaymentService, PaymobService, PaymentTransactionService],
})
export class PaymentModule {}
