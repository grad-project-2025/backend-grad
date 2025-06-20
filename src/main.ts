import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app/app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ErrorResponseDto } from './common/dto/error-response.dto';
import * as fs from 'fs';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  // Add raw body parser for Stripe webhooks (must be before Fastify/Nest setup)
  // Fastify does not use Express middleware, so this is for reference if you switch to Express.
  // For Fastify, you need to use the 'rawBody' option in NestFactory and Fastify's built-in hooks.

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            messageFormat: '{msg} - {req.method} {req.url} {res.statusCode}',
            customColors: 'err:red,info:blue,warn:yellow,debug:green',
          },
        },
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            ip: req.ip,
            headers: req.headers,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
    { rawBody: true }, // <-- This enables rawBody for all requests in NestJS Fastify
  );



  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const errorResponse: Record<string, string> = {};
        errors.forEach((error) => {
          const constraints = error.constraints || {};
          errorResponse[error.property] = Object.values(constraints).join(', ');
        });
        return new BadRequestException({
          success: false,
          message: 'Please check the following fields',
          errors: errorResponse,
        });
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS removed for production - configure at reverse proxy level
  // app.enableCors({
  //   origin: ['http://localhost:3001', 'http://localhost:3000'],
  //   credentials: true,
  // });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on port ${port}`);
}

void bootstrap();
