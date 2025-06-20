import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtUser } from '../interfaces/jwtUser.interface';
import { FastifyRequest } from 'fastify';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtUser => {
    const request: FastifyRequest = ctx.switchToHttp().getRequest();
    const user = request.user;
    console.log('User from request:', user);
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }
    if (typeof user.id !== 'string' || typeof user.email !== 'string') {
      throw new UnauthorizedException('Invalid user data');
    }
    return user as JwtUser;
  },
);
