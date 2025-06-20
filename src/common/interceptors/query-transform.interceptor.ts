import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class QueryTransformInterceptor implements NestInterceptor {
  private readonly parameterMappings: { [key: string]: string } = {
    departuretimerange: 'departureTimeRange',
    DepartureTimeRange: 'departureTimeRange',
  };

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const query = request.query;

    // Transform query parameters to their correct casing
    for (const [key, value] of Object.entries(query)) {
      const correctKey = this.parameterMappings[key.toLowerCase()];
      if (correctKey && correctKey !== key) {
        query[correctKey] = value;
        delete query[key];
      }
    }

    return next.handle();
  }
}
