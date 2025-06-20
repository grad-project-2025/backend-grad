import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FlightController } from './flight.controller';
import { FlightService } from './flight.service';
import { AmadeusService } from './services/amadeus.service';
import { FlightStatusService } from './services/flight-status.service';
import { FlightSearchService } from './services/flight-search.service';
import { FlightFormattingService } from './services/flight-formatting.service';
import { BaggageService } from './services/baggage.service';
import { CacheService } from './services/cache.service';
import { ExchangeRateService } from './services/exchange-rate.service';
import { EmailModule } from '../email/email.module';
import { MongooseModule } from '@nestjs/mongoose';
import { FlightSchema, SeatHoldSchema } from './schemas/flight.schema';
import { FlightRepository } from './repositories/flight.repository';
import { FLIGHT_REPOSITORY } from './repositories/flight.repository.interface';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { ConfigService } from '@nestjs/config';
import { PricingService } from './services/pricing.service';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EmailModule,
    CacheModule.registerAsync({
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        socket: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
        },
        ttl: configService.get('CACHE_TTL') || 3600,
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: 'Flight', schema: FlightSchema }]),
  ],
  controllers: [FlightController],
  providers: [
    FlightService,
    AmadeusService,
    FlightStatusService,
    FlightSearchService,
    FlightFormattingService,
    BaggageService,
    CacheService,
    ExchangeRateService,
    PricingService,
    FlightRepository,
    { provide: FLIGHT_REPOSITORY, useClass: FlightRepository },
  ],
  exports: [FlightService, AmadeusService, FlightStatusService],
})
export class FlightModule {}
