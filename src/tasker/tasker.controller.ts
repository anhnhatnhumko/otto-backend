import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TaskerService } from './tasker.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('tasker')
@UseGuards(JwtAuthGuard)
@Roles(Role.TASKER)
export class TaskerController {
  constructor(private taskerService: TaskerService) {}

  // PROFILE
  @Get('profile')
  getProfile(@Req() req) {
    return this.taskerService.getProfile(req.user.userId);
  }

  @Patch('profile')
  updateProfile(@Req() req, @Body() dto: any) {
    return this.taskerService.updateProfile(req.user.userId, dto);
  }

  // ONLINE
  @Patch('online')
  setOnline(@Req() req) {
    return this.taskerService.setOnline(req.user.userId);
  }

  @Patch('offline')
  setOffline(@Req() req) {
    return this.taskerService.setOffline(req.user.userId);
  }

  // ACTIVE ORDER
  @Get('active-order')
  getActiveOrder(@Req() req) {
    return this.taskerService.getActiveOrder(req.user.userId);
  }

  // HISTORY
  @Get('history')
  getHistory(@Req() req) {
    return this.taskerService.getHistory(req.user.userId);
  }

  // STATS
  @Get('stats')
  getStats(@Req() req) {
    return this.taskerService.getStats(req.user.userId);
  }
}