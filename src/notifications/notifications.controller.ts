import { Controller, Get, Req, UseGuards, Query, Post, Param, Patch, Delete } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from 'src/common/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('user/:userId')
  async getUserNotifications(@Param('userId') userId: string, @Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 20;
    return this.notificationsService.findForUser(userId, l);
  }

  @Get()
  async list(@Req() req, @Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : undefined;
    return this.notificationsService.findForUser(req.user.userId, l);
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @Post(':id/read')
  async markReadPost(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @Patch('user/:userId/read-all')
  async markAllReadPatch(@Param('userId') userId: string) {
    return this.notificationsService.markAllReadForUser(userId);
  }

  @Post('read-all')
  async markAllRead(@Req() req) {
    return this.notificationsService.markAllReadForUser(req.user.userId);
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string) {
    return this.notificationsService.deleteNotification(id);
  }
}
