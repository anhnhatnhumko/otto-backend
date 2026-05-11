import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from './order.schema';
import { OrderStatus } from './order-status.enum';
import { PaymentOrchestratorService } from 'src/payments/payment-orchestrator.service';
import { AdminGateway } from 'src/admin/admin.gateway';

@Injectable()
export class OrderTimeoutService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private paymentOrchestrator: PaymentOrchestratorService,
    private adminGateway: AdminGateway,
  ) { }

  @Cron('*/10 * * * * *') // mỗi 10s
  async handleTimeout() {
    const now = new Date();

    const expiredOrders = await this.orderModel.find({
      status: OrderStatus.SEARCHING,
      offerExpiresAt: { $lte: now },
    });

    if (!expiredOrders.length) return;

    console.log("TIMEOUT ORDERS:", expiredOrders.length);

    // await this.orderModel.updateMany(
    //   {
    //     _id: { $in: expiredOrders.map(o => o._id) },
    //   },
    //   {
    //     status: OrderStatus.TIMEOUT,
    //   },
    // );

    for (const order of expiredOrders) {
      console.log("⏰ TIMEOUT:", order._id);

      order.status = OrderStatus.TIMEOUT;
      await order.save();

      this.adminGateway.emitOrderStatusUpdated({
        orderId: order._id.toString(),
        status: order.status,
      });

      await this.paymentOrchestrator.handleTimeout(order);
    }
  }
}