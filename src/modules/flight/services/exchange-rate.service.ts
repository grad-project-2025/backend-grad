import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CacheService } from './cache.service';
import { EXCHANGE_RATES } from '../interfaces/flight-data.interface';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(private readonly cacheService: CacheService) {}

  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    const cacheKey = `exchange:${fromCurrency}:${toCurrency}`;
    const cachedRate = await this.cacheService.get<number>(cacheKey);
    if (cachedRate) {
      this.logger.log(
        `Cache hit for exchange rate ${fromCurrency} to ${toCurrency}`,
      );
      return cachedRate;
    }

    try {
      const response = await axios.get(
        `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`,
      );
      const rate = response.data.rates[toCurrency] || 1;
      await this.cacheService.set(cacheKey, rate, 86400);
      return rate;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch exchange rate for ${fromCurrency} to ${toCurrency}: ${error.message}`,
      );
      const fallbackRate =
        EXCHANGE_RATES[`${fromCurrency}_TO_${toCurrency}`] || 1;
      return fallbackRate;
    }
  }
}
