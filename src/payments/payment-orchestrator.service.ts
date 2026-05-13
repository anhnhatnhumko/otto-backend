import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from 'src/orders/order-status.enum';
import { generateOtp } from './otp.util';
import { Model, Types } from 'mongoose';
import { MailService } from 'src/mail/mail.service';
import { Order } from 'src/orders/order.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Transaction, TransactionType } from 'src/wallet/schemas/transaction.schema';
import { User } from 'src/users/user.schema';
import { Wallet } from 'src/wallet/schemas/wallet.schema';
import { TransactionStatus } from 'src/wallet/enums/transaction-status.enum';
import { StripeService } from './stripe.service';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class PaymentOrchestratorService {
    constructor(
        // private readonly walletService: WalletService,
        @Inject(forwardRef(() => OrdersService))
        private readonly orderService: OrdersService,
        private readonly mailService: MailService,

        @InjectModel(Order.name)
        private orderModel: Model<Order>,

        @InjectModel(Transaction.name)
        private txModel: Model<Transaction>,

        @InjectModel(User.name)
        private userModel: Model<User>,
        @InjectModel(Wallet.name)
        private walletModel: Model<Wallet>,
        private readonly notificationsService: NotificationsService,
        private readonly walletService: WalletService,
        private readonly stripeService: StripeService,
        // private readonly orderService: OrdersService,
    ) { }

    // WALLET PAYMENT
    // async payWithWallet(userId: string, orderId: string, amount: number) {
    //     await this.walletService.payOrder(userId, orderId, amount);
    //     return {
    //         success: true,
    //         orderId,
    //     };
    // }

    async createWalletPayment(userId: string, orderId: string) {
        const order = await this.orderModel.findById(orderId);

        if (!order) throw new NotFoundException();

        if (order.status !== OrderStatus.PENDING_PAYMENT) {
            throw new BadRequestException('Invalid order state');
        }

        const otp = generateOtp();

        const tx = await this.txModel.create({
            userId: new Types.ObjectId(userId),
            orderId: new Types.ObjectId(orderId),
            amount: -order.totalPrice,
            status: TransactionStatus.PENDING,
            type: TransactionType.PAYMENT,

            otpCode: otp,
            otpExpires: new Date(Date.now() + 5 * 60 * 1000),
            isOtpVerified: false,

            externalId: `OTP_${orderId}_${Date.now()}`,
            paymentMethod: 'WALLET',
        });

        const user = await this.userModel.findById(userId);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        await this.mailService.sendOtpEmail(user.email, otp);

        return {
            message: 'OTP sent',
            transactionId: tx._id,
        };
    }

    async createStripeSession(orderId: string, userId: string) {
        const order = await this.orderModel.findById(orderId);

        if (!order) throw new NotFoundException();

        if (order.status !== OrderStatus.PENDING_PAYMENT) {
            throw new BadRequestException('Invalid state');
        }

        return this.stripeService.createCheckoutSession({
            amount: order.totalPrice,
            name: `Order ${orderId}`,
            metadata: {
                type: 'ORDER',
                orderId: orderId.toString(),
                userId,
            },
        });
    }

    async handleStripeSuccess(metadata: any) {
        const { type } = metadata;

        if (type === 'ORDER') {
            return this.handleStripeOrder(metadata);
        }

        if (type === 'WALLET') {
            return this.walletService.handleStripeSuccess(metadata.transactionId);
        }
    }

    async handleStripeOrder(meta: any) {
        const { orderId, userId } = meta;

        // 🔥 IDEMPOTENT CHECK
        const exists = await this.txModel.findOne({
            externalId: `STRIPE_${orderId}`,
        });

        if (exists) {
            console.log("⚠️ Already processed");
            return;
        }

        const order = await this.orderModel.findById(orderId);
        if (!order) throw new NotFoundException();

        // 🔥 1. CREATE TRANSACTION
        await this.txModel.create({
            userId,
            orderId,
            amount: -order.totalPrice,
            type: 'PAYMENT',
            status: 'SUCCESS',
            externalId: `STRIPE_${orderId}`,
            paymentMethod: 'STRIPE',
        });

        // 🔥 2. ESCROW
        await this.walletService.createEscrowTransaction({
            userId,
            orderId,
            amount: order.totalPrice,
        });

        // 🔥 3. MARK PAID
        const updated = await this.orderService.markAsPaid(orderId, userId);

        // 🔥 4. DISPATCH
        await this.orderService.dispatchTasker(updated);

        return;
    }

    async verifyWalletPayment(userId: string, txId: string, otp: string) {
        const tx = await this.txModel.findById(txId);

        if (!tx) throw new NotFoundException();

        // validate OTP ...

        const amount = Math.abs(tx.amount);

        // 🔥 TRỪ TIỀN + ESCROW
        await this.walletModel.updateOne(
            { userId },
            {
                $inc: {
                    balance: -amount,
                    pendingBalance: amount,
                },
            },
        );

        // 🔥 MARK TX
        tx.status = TransactionStatus.SUCCESS;
        await tx.save();

        // 🔥 MARK ORDER
        const order = await this.orderService.markAsPaid(
            tx.orderId.toString(),
            userId,
        );

        // 🔥 DISPATCH
        await this.orderService.dispatchTasker(order);

        return { success: true };
    }

    async release(order: any) {
        if (order.paymentMethod === 'cash') {
            return this.walletService.addEarning(
                order.taskerId.toString(),
                order.totalPrice,
            );
        }

        return this.walletService.releaseEscrow(
            order.customerId.toString(),
            order.taskerId.toString(),
            order.totalPrice,
        );
    }

    

    private async refundOrder(
        order: any,
        notification: { title: string; content: string },
    ) {
        if (order.isRefunded) return;

        if (!order.paidAt) return;
        // Normalize paymentMethod string and skip refund for cash payments
        if ((order.paymentMethod || '').toString().toLowerCase() === 'cash') return;

        await this.walletService.refundEscrow(
            order.customerId.toString(),
            order.totalPrice,
        );

        order.isRefunded = true;
        await order.save();

        try {
            await this.notificationsService.createNotification(
                order.customerId.toString(),
                {
                    title: notification.title,
                    content: notification.content,
                    type: 'refund',
                    orderId: order._id.toString(),
                },
            );
        } catch (err) {
            console.warn('Failed to create refund notification', err);
        }
    }

    async handleTimeout(order: any) {
        return this.refundOrder(order, {
            title: 'Hoàn tiền đã được trả về ví',
            content: `Đơn hàng ${order._id} đã được hoàn ${order.totalPrice}đ vào ví của bạn.`,
        });
    }

    async handleCancellation(order: any) {
        return this.refundOrder(order, {
            title: 'Đơn hàng đã được hủy',
            content: `Đơn hàng ${order._id} đã được hủy và ${order.totalPrice}đ đã được hoàn về ví của bạn.`,
        });
    }
}