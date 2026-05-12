import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from '../orders/order.schema';
import { OrderStatus } from '../orders/order-status.enum';
import { StripeService } from './stripe.service';
import { WalletService } from 'src/wallet/wallet.service';
import { OrdersService } from 'src/orders/orders.service';
import { PaymentOrchestratorService } from './payment-orchestrator.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Order.name)
    private orderModel: Model<Order>,
    private stripeService: StripeService,
    private walletService: WalletService,
    private orderService: OrdersService,
    private orchestrator: PaymentOrchestratorService,
    private paymentOrchestrator: PaymentOrchestratorService,
  ) { }

  async createPayment(orderId: string, userId: string, method: string) {
    switch (method) {
      case 'stripe':
        return this.orchestrator.createStripeSession(orderId, userId);

      case 'wallet':
        return this.orchestrator.createWalletPayment(userId, orderId);

      default:
        throw new BadRequestException('Invalid payment method');
    }
  }

  async handleStripeWebhook(rawBody: Buffer, sig: string) {
    let event;

    try {
      event = this.stripeService.constructEvent(rawBody, sig);
    } catch (err) {
      console.error('Webhook verify failed:', err.message);
      return { received: false };
    }

    // 👇 log để debug
    console.log('WEBHOOK HIT');
    console.log('Event type:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata;

      console.log("🔥 SESSION:", session);
      console.log("🔥 METADATA:", session.metadata);

      if (!metadata?.type) return;

      console.log("🔥 TYPE:", metadata?.type);
      switch (metadata.type) {
        case 'ORDER': {
          console.log("📦 ORDER CASE HIT");

          const order = await this.orderModel.findById(metadata.orderId);
          if (!order) return;

          // order.status = OrderStatus.PAID;
          // order.paidAt = new Date();
          // await order.save();

          await this.paymentOrchestrator.handleStripeSuccess({
            type: 'ORDER',
            userId: order.customerId.toString(),
            orderId: order._id.toString(),
            amount: order.totalPrice,
          });

          // await this.orderService.dispatchTasker(order);

          break;
        }

        case 'WALLET': {
          console.log("💰 WALLET CASE HIT");
          console.log("💰 transactionId:", metadata.transactionId);

          await this.paymentOrchestrator.handleStripeSuccess({
            type: 'WALLET',
            transactionId: metadata.transactionId,
            userId: '',
            amount: 0,
          });

          break;
        }

        default:
          console.log("❌ UNKNOWN TYPE:", metadata.type);
      }
    }

    return { received: true };
  }

  async confirmStripeSession(sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('Missing Stripe session id');
    }

    console.log('[payments] confirmStripeSession called for', sessionId);

    const session = await this.stripeService.retrieveCheckoutSession(sessionId);
    console.log('[payments] stripe session:', {
      id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      metadata: session.metadata,
    });

    if (session.payment_status !== 'paid') {
      console.warn('[payments] stripe session not paid yet', session.payment_status);
      throw new BadRequestException('Stripe session is not paid');
    }

    const metadata = session.metadata;

    if (!metadata?.type) {
      throw new BadRequestException('Missing Stripe metadata');
    }

    console.log('[payments] calling orchestrator.handleStripeSuccess for metadata', metadata);
    await this.paymentOrchestrator.handleStripeSuccess(metadata);
    console.log('[payments] orchestrator.handleStripeSuccess returned');

    switch (metadata.type) {
      case 'ORDER':
        return {
          redirectUrl: `${process.env.FRONTEND_URL}/payment/success?orderId=${metadata.orderId}`,
        };

      case 'WALLET':
        return {
          redirectUrl: `${process.env.FRONTEND_URL}/deposit/success?transactionId=${metadata.transactionId}`,
        };

      default:
        throw new BadRequestException('Unsupported Stripe metadata type');
    }
  }

  // ==========================
  // HANDLE PAYMENT SUCCESS
  // ==========================
  async handlePaymentSuccess(orderId: string) {
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Invalid payment state');
    }

    order.status = OrderStatus.PAID;
    order.paidAt = new Date();

    await order.save();

    await this.orderService.dispatchTasker(order);

    return order;
  }

  // ==========================
  // OPTIONAL: CANCEL PAYMENT
  // ==========================
  async handlePaymentFail(orderId: string) {
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      throw new NotFoundException();
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException();
    }

    // giữ nguyên trạng thái để retry
    return {
      message: 'Payment failed, please retry',
    };
  }
}
