import { Controller, Delete, Get, Param, Patch, Query, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { UploadService } from 'src/avatar/upload.service';

@Controller('admin')
export class AdminController {
    constructor(private readonly adminService: AdminService, private readonly uploadService: UploadService) { }

    @Get('dashboard')
    getDashboard() {
        return this.adminService.getDashboard();
    }

    @Post('taskers')
    @UseInterceptors(FileInterceptor('avatar'))
    async createTasker(@Body() dto: any, @UploadedFile() avatar?: Express.Multer.File) {
        if (avatar) {
            try {
                const upload = await this.uploadService.uploadAvatar(avatar);
                dto = { ...(dto || {}), avatarUrl: upload.url };
            } catch (err) {
                console.error('Error uploading avatar during admin createTasker:', err);
                // proceed without blocking creation
            }
        }

        return this.adminService.createTasker(dto);
    }

    @Patch('taskers/:id/approve')
    approveTasker(@Param('id') id: string) {
        return this.adminService.approveTasker(id);
    }

    @Get('revenue')
    getRevenue(@Query() q) {
        return this.adminService.getRevenue(q.from, q.to);
    }

    @Get('orders')
    getOrders(@Query() q) {
        return this.adminService.getOrders(q);
    }

    @Get('transactions')
    getTransactions(@Query() q) {
        return this.adminService.getTransactions(q);
    }

    @Get('users')
    getUsers(@Query() q) {
        return this.adminService.getUsers(q);
    }

    @Get('top-taskers')
    getTopTaskers() {
        return this.adminService.getTopTaskers();
    }

    @Patch('taskers/:id/ban')
    banTasker(@Param('id') id: string) {
        return this.adminService.banTasker(id);
    }

    @Patch('taskers/:id/activate')
    activateTasker(@Param('id') id: string) {
        return this.adminService.activateTasker(id);
    }

    @Patch('users/:id/ban')
    banUser(@Param('id') id: string) {
        return this.adminService.banUser(id);
    }

    @Patch('users/:id/activate')
    activateUser(@Param('id') id: string) {
        return this.adminService.activateUser(id);
    }

    @Patch('orders/:id/confirm')
    confirmOrder(@Param('id') id: string) {
        return this.adminService.confirmOrderByAdmin(id);
    }

    @Patch('orders/:id/cancel')
    cancelOrder(@Param('id') id: string) {
        return this.adminService.cancelOrderByAdmin(id);
    }

    @Patch('orders/:id/complete')
    completeOrder(@Param('id') id: string) {
        return this.adminService.completeOrderByAdmin(id);
    }

    @Delete('taskers/:id/reject')
    rejectTasker(@Param('id') id: string) {
        return this.adminService.rejectTasker(id);
    }
}