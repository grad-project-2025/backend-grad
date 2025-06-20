import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly CACHE_TTL = 60 * 60; // 1 hour

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async set<T>(
    key: string,
    value: T,
    ttl: number = this.CACHE_TTL,
  ): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return await this.cacheManager.get<T>(key);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testKey = `health_check_${Date.now()}`;
      await this.set(testKey, { test: true });
      const value = await this.get<{ test: boolean }>(testKey);
      return value?.test === true;
    } catch (error) {
      this.logger.error(`Cache health check failed: ${error.message}`);
      return false;
    }
  }
}
