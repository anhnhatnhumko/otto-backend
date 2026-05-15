import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { PaymentOrchestratorService } from 'src/payments/payment-orchestrator.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private paymentOrchestrator: PaymentOrchestratorService,
    private orderService: OrdersService,
  ) { }

  // ==========================
  // CUSTOMER - CREATE
  // ==========================
  @Post()
  @Roles(Role.CUSTOMER)
  create(@Req() req, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.userId, dto);
  }

  // ==========================
  // CUSTOMER - FILTER ORDERS (NEW)
  // ==========================
  @Get()
  @Roles(Role.CUSTOMER)
  findByStatus(
    @Req() req,
    @Query('status') status?: string,
    @Query('sort') sort: string = '-createdAt',
    @Query('limit') limit: string = '20',
  ) {
    return this.ordersService.findMyOrdersByStatus(
      req.user.userId,
      status,
      sort,
      parseInt(limit),
    );
  }

  // ==========================
  // CUSTOMER - MY ORDERS
  // ==========================
  @Get('my')
  @Roles(Role.CUSTOMER)
  findMy(@Req() req) {
    return this.ordersService.findMyOrders(req.user.userId);
  }

  // ==========================
  // TASKER - AVAILABLE JOBS
  // ==========================
  @Get('available')
  @Roles(Role.TASKER)
  findAvailable(@Req() req) {
    return this.ordersService.findAvailableOrders(req.user.userId);
  }

  // ==========================
  // TASKER - ORDER
  // ==========================
  @Get('my-tasker')
  @Roles(Role.TASKER)
  findMyTasker(@Req() req) {
    return this.ordersService.findMyTaskerOrders(req.user.userId);
  }

  // ==========================
  // ORDER DETAIL
  // ==========================
  @Get(':id')
  @Roles(Role.CUSTOMER, Role.TASKER, Role.ADMIN)
  findOne(@Param('id') id: string, @Req() req) {
    return this.ordersService.findById(id, req.user);
  }

  // ==========================
  // TASKER - ACCEPT
  // ==========================
  @Patch(':id/accept')
  @Roles(Role.TASKER)
  accept(@Param('id') id: string, @Req() req) {
    return this.ordersService.acceptOrder(id, req.user.userId);
  }

  // ==========================
  // TASKER - REJECT
  // ==========================
  @Patch(':id/reject')
  @Roles(Role.TASKER)
  reject(@Param('id') id: string, @Req() req) {
    return this.ordersService.rejectOrder(id, req.user.userId);
  }

  // ==========================
  // TASKER - START
  // ==========================
  @Patch(':id/start')
  @Roles(Role.TASKER)
  start(@Param('id') id: string, @Req() req) {
    return this.ordersService.startOrder(id, req.user.userId);
  }

  // ==========================
  // TASKER - COMPLETE
  // ==========================
  @Patch(':id/complete')
  @Roles(Role.TASKER)
  complete(@Param('id') id: string, @Req() req) {
    return this.ordersService.completeOrder(id, req.user.userId);
  }

  // ==========================
  // CUSTOMER - CONFIRM COMPLETED
  // ==========================
  @Patch(':id/confirm-completed')
  @Roles(Role.CUSTOMER)
  async confirmCompleted(@Req() req, @Param('id') id: string) {
    const userId = req.user.userId;

    // 🔥 1. update order
    const order = await this.orderService.confirmCompleted(id, userId);

    // 🔥 2. release tiền
    await this.paymentOrchestrator.release(order);

    return order;
  }

  // ==========================
  // CUSTOMER - RATE COMPLETED ORDER
  // ==========================
  @Patch(':id/rate')
  @Roles(Role.CUSTOMER)
  rateCompletedOrder(@Req() req, @Param('id') id: string, @Body() body: { rating: number; review?: string }) {
    return this.ordersService.rateCompletedOrder(id, req.user.userId, body);
  }

  // ==========================
  // CUSTOMER - CANCEL
  // ==========================
  @Patch(':id/cancel')
  @Roles(Role.CUSTOMER)
  cancel(@Param('id') id: string, @Req() req) {
    return this.ordersService.cancelOrder(id, req.user.userId);
  }

  // ==========================
  // CUSTOMER - KEEP OVERDUE ORDER
  // ==========================
  @Patch(':id/timeout-keep')
  @Roles(Role.CUSTOMER)
  timeoutKeep(@Param('id') id: string, @Req() req) {
    return this.ordersService.keepTimeoutOrder(id, req.user.userId);
  }

  @Post('wallet/create-payment')
  async createWalletPayment(@Req() req, @Body() body) {
    return this.paymentOrchestrator.createWalletPayment(
      req.user.userId,
      body.orderId,
    );
  }

  @Post('wallet/verify-payment')
  async verifyWalletPayment(@Req() req, @Body() body) {
    return this.paymentOrchestrator.verifyWalletPayment(
      req.user.userId,
      body.transactionId,
      body.otp,
    );
  }

  // ==========================
  // AUTO TIMEOUT
  // ==========================
  @Post('auto-timeout')
  async autoTimeout() {
    return this.ordersService.handleTimeoutOrders();
  }
}