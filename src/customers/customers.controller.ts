import { Controller, Get, Patch, UseGuards, Query, Body } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get('profile-stats')
  async getProfileStats(@CurrentUser() user: any) {
    return this.customersService.getProfileStats(user._id);
  }

  @Get('favorite-services')
  async getFavoriteServices(@CurrentUser() user: any) {
    return this.customersService.getFavoriteServices(user._id);
  }

  @Get('profile')
  async getCustomerProfile(@CurrentUser() user: any) {
    return this.customersService.getCustomerProfile(user._id);
  }

  @Patch('profile')
  async updateCustomerProfile(@CurrentUser() user: any, @Body() dto: any) {
    return this.customersService.updateProfile(user._id, dto);
  }
}

/**
 * Promotions endpoint (can be accessed without auth for now)
 */
@Controller('promotions')
export class PromotionsController {
  @Get()
  async getPromotions(@Query('active') active?: string) {
    // Return mock promotions for now
    // In real app, this would query a Promotions collection
    const promotions = [
      {
        _id: '1',
        code: 'WELCOME50',
        title: 'Giảm 50% đơn đầu',
        description: 'Khuyến mãi cho khách hàng mới',
        discount: '50%',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        minOrderAmount: 100000,
      },
      {
        _id: '2',
        code: 'VIP100K',
        title: 'Tiết kiệm 100K',
        description: 'Mã cho thành viên VIP',
        discount: '100000',
        expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        minOrderAmount: 500000,
      },
      {
        _id: '3',
        code: 'SUMMER30',
        title: 'Mùa hè ưu đãi',
        description: 'Giảm giá mọi dịch vụ mùa hè',
        discount: '30%',
        expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        minOrderAmount: 200000,
      },
    ];

    return promotions;
  }
}
