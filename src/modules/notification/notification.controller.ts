import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Request } from 'express';
import { Notification } from './schemas/notification.schema';
import { AuthGuard } from '@nestjs/passport';
import { RequestUser } from 'src/common/interfaces/request-user.interface';
import { Role } from 'src/common/enums/role.enum';

@UseGuards(AuthGuard('jwt'))
@Controller('notification')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get('')
  async getNotifications(@Req() req: Request): Promise<Notification[]> {
    const user = req.user as RequestUser;

    const topic =
      Array.isArray(user.roles) && user.roles.includes(Role.Admin)
        ? 'admin'
        : user.id;

    return await this.notificationService.getNotifications(topic);
  }

  @Get('count')
  async getNotificationCount(@Req() req: Request): Promise<{ count: number }> {
    const user = req.user as RequestUser;

    const topic =
      Array.isArray(user.roles) && user.roles.includes(Role.Admin)
        ? 'admin'
        : user.id;

    return await this.notificationService.getNotificationsCount(topic);
  }
}
