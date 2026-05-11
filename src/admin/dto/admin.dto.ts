import { IsOptional, IsNumberString, IsEnum } from 'class-validator';
import { Types } from 'mongoose';

export class PaginationDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}

export class OrderFilterDto extends PaginationDto {
  @IsOptional()
  status?: string;
}

export class TransactionFilterDto extends PaginationDto {
  @IsOptional()
  type?: string;
}

export class UserFilterDto extends PaginationDto {
  @IsOptional()
  role?: string;
}

export class DashboardResponseDto {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  totalTransactions: number;
}

export interface AdminOrderDto {
  id: string;

  customerName: string;
  customerPhone: string;
  customerEmail: string;

  serviceName: string;

  address: string;

  startTime: string;
  createdAt: string;

  status: string;

  totalPrice: number;

  taskerName?: string;
}