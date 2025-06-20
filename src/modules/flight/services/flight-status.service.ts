import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AmadeusService } from './amadeus.service';

@Injectable()
export class FlightStatusService {
  private readonly logger = new Logger(FlightStatusService.name);

  constructor(private readonly amadeusService: AmadeusService) {}

  async getFlightStatus(
    flightNumber: string,
    departureTime: Date,
  ): Promise<string> {
    try {
      const status = await this.amadeusService.getFlightStatus(flightNumber);
      return status || 'Unknown';
    } catch (error) {
      this.logger.error(
        `Failed to fetch flight status for ${flightNumber}: ${(error as Error).message}`,
      );
      return 'Unknown';
    }
  }
}
