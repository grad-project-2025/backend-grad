import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { BaggageSelectionDto } from '../dto/baggage.dto';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Flight, BaggageOptions } from '../schemas/flight.schema';
import { BaggageOptionDto } from '../interfaces/flight-data.interface';

@Injectable()
export class BaggageService {
  private readonly logger = new Logger(BaggageService.name);

  constructor(
    @InjectModel('Flight') private readonly flightModel: Model<Flight>,
  ) {}

  async validateBaggage(
    flightId: string,
    options: BaggageSelectionDto[],
  ): Promise<boolean> {
    const flight = await this.flightModel.findById(flightId).lean();
    if (!flight || !flight.baggageOptions) {
      this.logger.warn(
        `Flight not found or no baggage options for flightId: ${flightId}`,
      );
      throw new HttpException(
        'Flight not found or no baggage options available',
        HttpStatus.NOT_FOUND,
      );
    }

    const baggageOptions = this.parseBaggageOptions(flight.baggageOptions);
    return options.every((selected) => {
      const available = baggageOptions.find(
        (opt) => opt.type === selected.type,
      );
      return available && selected.quantity <= (available.quantity || 2);
    });
  }

  private parseBaggageOptions(options: BaggageOptions): BaggageOptionDto[] {
    if (!options?.options) return [];
    const seen = new Set();

    return options.options
      .filter((opt) => opt.weightInKg && opt.price)
      .map((opt) => {
        const normalizedType = this.normalizeBaggageType(opt.type);
        return {
          type: normalizedType,
          quantity: opt.quantity || 2,
          price: opt.price.toFixed(2),
          description: `${opt.weightInKg}kg ${normalizedType.toLowerCase().replace('_', ' ')}`,
          weight: opt.weightInKg,
        };
      })
      .filter((opt) => {
        const key = `${opt.type}-${opt.price}-${opt.weight}`;
        return !seen.has(key) && seen.add(key);
      });
  }

  private normalizeBaggageType(
    type: string | undefined,
  ): 'CARRY_ON' | 'CHECKED' | 'PERSONAL_ITEM' {
    if (!type) return 'CHECKED';

    const upperType = type.toUpperCase();
    switch (upperType) {
      case 'CARRY_ON':
        return 'CARRY_ON';
      case 'PERSONAL_ITEM':
        return 'PERSONAL_ITEM';
      case 'CHECKED':
        return 'CHECKED';
      default:
        this.logger.warn(
          `Unknown baggage type "${type}" defaulting to CHECKED`,
        );
        return 'CHECKED';
    }
  }
}
