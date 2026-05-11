import {
    Injectable,
    BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Wallet } from './schemas/wallet.schema';
import { Transaction, TransactionStatus, TransactionType } from './schemas/transaction.schema';
import { Model, Types } from 'mongoose';
import { StripeService } from '../payments/stripe.service';
import { BankAccount } from './schemas/bank-account.schema';
import { FakeBank } from './schemas/fake-bank.schema';
import { WithdrawDto } from './dto/withdraw.dto';

@Injectable()
export class WalletService {
    constructor(
        @InjectModel(Wallet.name) private walletModel: Model<Wallet>,

        // @InjectModel('Order') private orderModel: Model<any>,

        @InjectModel(BankAccount.name)
        private bankAccountModel: Model<BankAccount>,

        @InjectModel(FakeBank.name)
        private fakeBankModel: Model<FakeBank>,

        @InjectModel(Transaction.name)
        private txModel: Model<Transaction>,
        private stripeService: StripeService,
    ) { }

    async getWallet(userId: string) {
        return this.walletModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            {
                $setOnInsert: {
                    userId: new Types.ObjectId(userId),
                    balance: 0,
                    pendingBalance: 0,
                }
            },
            { upsert: true, new: true },
        );
    }

    // ===== DEPOSIT (STRIPE) =====
    async deposit(userId: string, amount: number) {
        console.log("🔥 SERVICE HIT");
        console.log("🔥 USER ID:", userId);
        console.log("🔥 AMOUNT:", amount);
        const externalId = `STRIPE_${Date.now()}`;

        const tx = await this.txModel.create({
            userId: new Types.ObjectId(userId),
            amount,
            type: TransactionType.DEPOSIT,
            status: TransactionStatus.PENDING,
            externalId,
            paymentMethod: 'STRIPE',
        });

        const session = await this.stripeService.createCheckoutSession({
            amount: Math.round(amount),
            name: 'Wallet Deposit',
            metadata: {
                type: 'WALLET',
                transactionId: tx._id.toString(),
            },
        });

        return {
            checkoutUrl: session.checkoutUrl,
            transactionId: tx._id,
        };
    }

    async withdraw(userId: string, dto: WithdrawDto) {
        const { amount, bankName, accountNumber } = dto;

        console.log("🔥 INPUT:", {
            userId: new Types.ObjectId(userId),
            amount,
            bankName,
            accountNumber,
        });

        if (!amount || amount <= 0) {
            throw new BadRequestException('Invalid amount');
        }

        // 🔥 1. CHECK BANK INFO
        const bank = await this.bankAccountModel.findOne({
            userId: new Types.ObjectId(userId),
            bankName,
            accountNumber,
        });

        console.log("🔥 BANK FOUND:", bank);


        if (!bank) {
            throw new BadRequestException('Bank info not match');
        }

        // 🔥 2. CHECK WALLET
        const wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) });
        console.log("🔥 WALLET:", wallet);

        if (!wallet || wallet.balance < amount) {
            throw new BadRequestException('Insufficient balance');
        }

        // 🔥 3. CREATE TRANSACTION
        const tx = await this.txModel.create({
            userId: new Types.ObjectId(userId),
            amount,
            type: TransactionType.WITHDRAW,
            status: TransactionStatus.PENDING,

            bankName,
            accountNumber,
            externalId: `WITHDRAW_${Date.now()}`,
            paymentMethod: 'BANK',
        });

        try {
            // 🔥 4. TRỪ TIỀN
            await this.walletModel.updateOne(
                { userId: new Types.ObjectId(userId) },
                { $inc: { balance: -amount } },
            );

            // 🔥 5. FAKE BANK
            let fake = await this.fakeBankModel.findOne({
                bankName,
                accountNumber,
            });

            if (!fake) {
                fake = await this.fakeBankModel.create({
                    bankName,
                    accountNumber,
                    balance: 0,
                });
            }

            await this.fakeBankModel.updateOne(
                { _id: fake._id },
                { $inc: { balance: amount } },
            );

            // 🔥 6. SUCCESS
            await this.txModel.updateOne(
                { _id: tx._id },
                { status: TransactionStatus.SUCCESS },
            );

            return {
                success: true,
                message: 'Withdraw success',
            };
        } catch (err) {
            await this.txModel.updateOne(
                { _id: tx._id },
                { status: TransactionStatus.FAILED },
            );

            throw err;
        }
    }

    // ===== WEBHOOK HANDLE =====
    async handleStripeSuccess(transactionId: string) {
        console.log("💰 WALLET SUCCESS HIT");
        console.log("💰 transactionId:", transactionId);
        const tx = await this.txModel.findById(transactionId);

        if (!tx) throw new BadRequestException('Transaction not found');
        console.log("💰 TX FOUND:", tx);

        // idempotent
        if (tx.status === TransactionStatus.SUCCESS) return;

        tx.status = TransactionStatus.SUCCESS;
        await tx.save();

        await this.walletModel.updateOne(
            { userId: tx.userId },
            { $inc: { balance: tx.amount } },
            { upsert: true },
        );
        console.log("💰 BALANCE UPDATED");
    }

    async getTransactions(userId: string) {
        const txs = await this.txModel
            .find({ userId: new Types.ObjectId(userId) }) // 🔥 FIX QUAN TRỌNG
            .sort({ createdAt: -1 })
            .lean();

        return txs.map((tx) => {
            const type = tx.type;

            const isPositive =
                type === 'DEPOSIT' ||
                type === 'REFUND' ||
                type === 'RECEIVE';

            let displayName = 'Giao dịch';

            switch (type) {
                case 'DEPOSIT':
                    displayName = `Nạp tiền qua ${tx.paymentMethod}`;
                    break;

                case 'PAYMENT':
                    displayName = `Thanh toán đơn hàng`;
                    break;

                case 'REFUND':
                    displayName = `Hoàn tiền đơn hàng`;
                    break;

                case 'WITHDRAW':
                    displayName = `Rút tiền`;
                    break;
            }

            return {
                _id: tx._id,
                type, // 🔥 thêm dòng này (rất quan trọng)
                amount: tx.amount,
                status: tx.status,
                isPositive,
                displayName,
                bankName: tx.bankName || 'Ngân hàng',
                accountNumber: tx.accountNumber || 'xxxx xxxx xxxx',
                method: tx.paymentMethod,
                createdAt: tx.createdAt || new Date(),
            };
        });
    }

    async createEscrowTransaction({ userId, orderId, amount }) {
        const exists = await this.txModel.findOne({
            externalId: `ESCROW_${orderId}`,
        });

        if (exists) return exists;

        await this.walletModel.updateOne(
            { userId },
            {
                $inc: { pendingBalance: amount },
            },
            { upsert: true },
        );

        return this.txModel.create({
            userId,
            orderId,
            amount: -amount,
            type: 'PAYMENT',
            status: 'PENDING',
            externalId: `ESCROW_${orderId}`,
            paymentMethod: 'STRIPE',
        });
    }

    async releaseEscrow(customerId: string, taskerId: string, amount: number) {
        console.log("🔥 RELEASE START");

        // 🔥 trừ pending
        const customerUpdate = await this.walletModel.updateOne(
            {
                userId: new Types.ObjectId(customerId),
                pendingBalance: { $gte: amount },
            },
            {
                $inc: { pendingBalance: -amount },
            },
        );

        if (customerUpdate.modifiedCount === 0) {
            throw new BadRequestException('Invalid escrow state');
        }

        // 🔥 cộng cho tasker
        await this.walletModel.updateOne(
            { userId: new Types.ObjectId(taskerId) },
            {
                $inc: { balance: amount, totalEarning: amount, },
                $setOnInsert: { pendingBalance: 0 },
            },
            { upsert: true },
        );

        // 🔥 log (idempotent)
        await this.txModel.updateOne(
            { externalId: `ORDER_${customerId}_${taskerId}` },
            {
                $setOnInsert: {
                    userId: new Types.ObjectId(customerId),
                    amount: -amount,
                    type: TransactionType.PAYMENT,
                    status: TransactionStatus.SUCCESS,
                },
            },
            { upsert: true },
        );

        await this.txModel.updateOne(
            { externalId: `ORDER_${taskerId}_${customerId}` },
            {
                $setOnInsert: {
                    userId: new Types.ObjectId(taskerId),
                    amount: amount,
                    type: TransactionType.RECEIVE,
                    status: TransactionStatus.SUCCESS,
                },
            },
            { upsert: true },
        );

        console.log("🔥 RELEASE DONE");
    }

    async addEarning(taskerId: string, amount: number) {
        console.log("💵 ADD EARNING:", amount);

        await this.walletModel.updateOne(
            { userId: new Types.ObjectId(taskerId) },
            {
                $inc: { totalEarning: amount, },
                $setOnInsert: { pendingBalance: 0 },
            },
            { upsert: true },
        );

        await this.txModel.create({
            userId: new Types.ObjectId(taskerId),
            amount: amount,
            type: TransactionType.RECEIVE,
            status: TransactionStatus.SUCCESS,
            externalId: `CASH_${Date.now()}`,
            paymentMethod: 'CASH',
        });
    }

    async refundEscrow(userId: string, amount: number) {
        // 🔥 cộng lại tiền
        await this.walletModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            { $inc: { balance: amount } },
        );

        // 🔥 tạo transaction
        await this.txModel.create({
            userId: new Types.ObjectId(userId),
            amount,
            type: TransactionType.REFUND,
            status: TransactionStatus.SUCCESS,
            externalId: `REFUND_${Date.now()}`,
            paymentMethod: 'SYSTEM',
        });
    }
}