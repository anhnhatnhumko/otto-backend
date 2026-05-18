import { Body, Controller, Get, Param, Post, Query, Patch, Delete } from '@nestjs/common';
import { TaskerRequestsService } from './tasker-requests.service';

@Controller()
export class TaskerRequestsController {
  constructor(private readonly service: TaskerRequestsService) {}

  @Post('admin/taskers/requests')
  async create(@Body() body: { formData: any; services: string[] }) {
    const saved = await this.service.create(body);
    return { success: true, data: saved };
  }

  // Admin endpoints
  @Get('admin/taskers/requests')
  async list() {
    const list = await this.service.findAll();
    return { success: true, data: list };
  }

  @Get('admin/taskers/requests/check-contact')
  async checkContact(
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    const result = await this.service.checkContact(email, phone);
    return { success: true, data: result };
  }

  @Get('admin/taskers/requests/:id')
  async detail(@Param('id') id: string) {
    const item = await this.service.findOne(id);
    return { success: !!item, data: item };
  }

  @Patch('admin/taskers/:id/approve')
  async approve(@Param('id') id: string) {
    const updated = await this.service.approve(id);
    return { success: !!updated, data: updated };
  }

  @Delete('admin/taskers/:id/reject')
  async reject(@Param('id') id: string) {
    const result = await this.service.reject(id);
    return { success: !!result, data: result };
  }
}
