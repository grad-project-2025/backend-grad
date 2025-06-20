import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Default error response structure
    const errorResponse = {
      success: false,
      message: exception.message || 'An error occurred',
      error: exception.name || 'Error',
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
      errors: {},
    };

    // Handle validation errors (BadRequestException)
    if (status === 400 && typeof exceptionResponse === 'object') {
      errorResponse.message =
        (exceptionResponse as any).message ||
        'Please check the following fields';
      errorResponse.errors = (exceptionResponse as any).errors || {};
    }

    // Handle other HTTP exceptions
    if (status !== 400 && typeof exceptionResponse === 'string') {
      errorResponse.message = exceptionResponse;
    } else if (status !== 400 && typeof exceptionResponse === 'object') {
      errorResponse.message =
        (exceptionResponse as any).message || exception.message;
    }

    response.status(status).send(errorResponse);
  }
}
