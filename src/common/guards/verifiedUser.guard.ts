import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { UserManagementService } from 'src/modules/users/services/user-management.service';
import { FastifyRequest } from 'fastify';

@Injectable()
export class VerifiedUserGuard implements CanActivate {
  constructor(private userManagementService: UserManagementService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: FastifyRequest = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userDoc = await this.userManagementService.getById(user.id);
    if (!userDoc || !userDoc.isVerified) {
      throw new UnauthorizedException('User email not verified');
    }

    return true;
  }
}
