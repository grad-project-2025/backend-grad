import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TransformInterceptor.name);

  constructor(private readonly i18n: I18nService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const language = request.query.language || 'en';

    return next.handle().pipe(
      switchMap(async (data) => {
        // this.logger.debug(`Transforming response for ${request.method} ${request.url}: ${JSON.stringify(data)}`);

        // Only modify flight search responses
        if (
          request.method === 'GET' &&
          request.url.includes('/flights/search/available') &&
          data?.data?.flights
        ) {
          const total = data.data?.pagination?.total || 0;
          const paginatedTotal = data.data?.flights?.length || 0;
          data.message = await this.i18n.t('response.foundFlights', {
            lang: language,
            args: { paginatedTotal, total },
            defaultValue: `Found ${paginatedTotal} available flight offers (out of ${total} total)`,
          });
        }

        return {
          success: data?.success !== false,
          message:
            data?.message ||
            this.i18n.t('response.success', { lang: language }),
          data: data?.data || data,
          error: data?.error || null,
          meta: data?.meta || null,
        };
      }),
    );
  }
}
