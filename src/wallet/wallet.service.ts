import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MailService } from 'src/mail/mail.service';
import { generateOtp } from 'src/payments/otp.util';
import { User } from 'src/users/user.schema';
import { StripeService } from '../payments/stripe.service';
import { WithdrawDto } from './dto/withdraw.dto';
import { BankAccount } from './schemas/bank-account.schema';
import { FakeBank } from './schemas/fake-bank.schema';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from './schemas/transaction.schema';
import { Wallet } from './schemas/wallet.schema';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
    @InjectModel(BankAccount.name)
    private bankAccountModel: Model<BankAccount>,
    @InjectModel(FakeBank.name)
    private fakeBankModel: Model<FakeBank>,
    @InjectModel(Transaction.name)
    private txModel: Model<Transaction>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    private mailService: MailService,
    private stripeService: StripeService,
  ) {}

  private appendQueryParams(
    rawUrl: string,
    params: Record<string, string | undefined>,
  ) {
    const url = String(rawUrl || '').trim();

    if (!url) {
      return '';
    }

    const queryEntries = Object.entries(params).filter(([, value]) =>
      Boolean(String(value ?? '').trim()),
    );

    if (queryEntries.length === 0) {
      return url;
    }

    const separator = url.includes('?') ? '&' : '?';
    const query = queryEntries
      .map(([key, value]) => {
        const rawValue = String(value ?? '');
        const encodedValue =
          rawValue === '{CHECKOUT_SESSION_ID}'
            ? rawValue
            : encodeURIComponent(rawValue);

        return `${encodeURIComponent(key)}=${encodedValue}`;
      })
      .join('&');

    return `${url}${separator}${query}`;
  }

  async getWallet(userId: string) {
    return this.walletModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          balance: 0,
          pendingBalance: 0,
        },
      },
      { upsert: true, new: true },
    );
  }

  async deposit(
    userId: string,
    amount: number,
    options?: {
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    console.log('WALLET DEPOSIT:', { userId, amount });
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
      successUrl: options?.successUrl
        ? this.appendQueryParams(options.successUrl, {
            paymentStatus: 'success',
            transactionId: tx._id.toString(),
            source: 'wallet',
            session_id: '{CHECKOUT_SESSION_ID}',
          })
        : undefined,
      cancelUrl: options?.cancelUrl
        ? this.appendQueryParams(options.cancelUrl, {
            paymentStatus: 'cancel',
            transactionId: tx._id.toString(),
            source: 'wallet',
          })
        : undefined,
    });

    return {
      checkoutUrl: session.checkoutUrl,
      transactionId: tx._id,
      sessionId: session.sessionId,
    };
  }

  private async validateWithdrawRequest(userId: string, dto: WithdrawDto) {
    const amount = Number(dto.amount ?? 0);
    const bankName = String(dto.bankName ?? '').trim();
    const accountNumber = String(dto.accountNumber ?? '')
      .replace(/\s/g, '')
      .trim();
    const userObjectId = new Types.ObjectId(userId);

    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    if (!bankName || !accountNumber) {
      throw new BadRequestException('Missing bank info');
    }

    const bank = await this.bankAccountModel.findOne({
      userId: userObjectId,
      bankName,
      accountNumber,
    });

    if (!bank) {
      throw new BadRequestException('Bank info not match');
    }

    const wallet = await this.walletModel.findOne({ userId: userObjectId });

    if (!wallet || wallet.balance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    return {
      amount,
      bankName,
      accountNumber,
      userObjectId,
    };
  }

  private async creditFakeBank(
    bankName: string,
    accountNumber: string,
    amount: number,
  ) {
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
  }

  private async finalizeWithdrawTransaction(
    userObjectId: Types.ObjectId,
    tx: any,
  ) {
    const amount = Math.abs(Number(tx.amount ?? 0));

    if (!amount) {
      throw new BadRequestException('Invalid transaction amount');
    }

    const wallet = await this.walletModel.findOne({ userId: userObjectId });

    if (!wallet || wallet.balance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    await this.walletModel.updateOne(
      { userId: userObjectId },
      { $inc: { balance: -amount } },
    );

    await this.creditFakeBank(
      String(tx.bankName ?? ''),
      String(tx.accountNumber ?? ''),
      amount,
    );

    tx.status = TransactionStatus.SUCCESS;
    tx.isOtpVerified = true;
    tx.otpCode = '';
    tx.otpExpires = undefined;
    await tx.save();

    return {
      success: true,
      message: 'Withdraw success',
      transactionId: tx._id,
    };
  }

  async withdraw(userId: string, dto: WithdrawDto) {
    const { amount, bankName, accountNumber, userObjectId } =
      await this.validateWithdrawRequest(userId, dto);

    const tx = await this.txModel.create({
      userId: userObjectId,
      amount,
      type: TransactionType.WITHDRAW,
      status: TransactionStatus.PENDING,
      bankName,
      accountNumber,
      externalId: `WITHDRAW_${Date.now()}`,
      paymentMethod: 'BANK',
      isOtpVerified: true,
    });

    try {
      return await this.finalizeWithdrawTransaction(userObjectId, tx);
    } catch (err) {
      await this.txModel.updateOne(
        { _id: tx._id },
        { status: TransactionStatus.FAILED },
      );
      throw err;
    }
  }

  async requestWithdrawOtp(userId: string, dto: WithdrawDto) {
    const { amount, bankName, accountNumber, userObjectId } =
      await this.validateWithdrawRequest(userId, dto);

    const user = await this.userModel.findById(userObjectId).select('email').lean();

    if (!user?.email) {
      throw new NotFoundException('User email not found');
    }

    const otp = generateOtp();

    const tx = await this.txModel.create({
      userId: userObjectId,
      amount,
      type: TransactionType.WITHDRAW,
      status: TransactionStatus.PENDING,
      bankName,
      accountNumber,
      otpCode: otp,
      otpExpires: new Date(Date.now() + 5 * 60 * 1000),
      isOtpVerified: false,
      externalId: `WITHDRAW_OTP_${Date.now()}`,
      paymentMethod: 'BANK',
    });

    await this.mailService.sendWithdrawOtpEmail(user.email, otp);

    return {
      message: 'OTP sent',
      transactionId: tx._id,
    };
  }

  async verifyWithdrawOtp(userId: string, transactionId: string, otp: string) {
    const userObjectId = new Types.ObjectId(userId);
    const normalizedOtp = String(otp ?? '').trim();

    if (normalizedOtp.length !== 6) {
      throw new BadRequestException('OTP không hợp lệ');
    }

    const tx = await this.txModel.findOne({
      _id: new Types.ObjectId(transactionId),
      userId: userObjectId,
      type: TransactionType.WITHDRAW,
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Transaction is no longer pending');
    }

    if (!tx.otpCode || tx.otpCode !== normalizedOtp) {
      throw new BadRequestException('OTP không hợp lệ');
    }

    if (!tx.otpExpires || tx.otpExpires.getTime() < Date.now()) {
      throw new BadRequestException('OTP đã hết hạn');
    }

    try {
      return await this.finalizeWithdrawTransaction(userObjectId, tx);
    } catch (err) {
      await this.txModel.updateOne(
        { _id: tx._id },
        { status: TransactionStatus.FAILED },
      );
      throw err;
    }
  }

  async handleStripeSuccess(transactionId: string) {
    console.log('WALLET SUCCESS:', transactionId);
    const tx = await this.txModel.findById(transactionId);

    if (!tx) {
      throw new BadRequestException('Transaction not found');
    }

    if (tx.status === TransactionStatus.SUCCESS) {
      return;
    }

    tx.status = TransactionStatus.SUCCESS;
    await tx.save();

    await this.walletModel.updateOne(
      { userId: tx.userId },
      { $inc: { balance: tx.amount } },
      { upsert: true },
    );
  }

  async getTransactions(userId: string) {
    const txs = await this.txModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();

    return txs.map((tx) => {
      const type = tx.type;
      const isPositive =
        type === 'DEPOSIT' || type === 'REFUND' || type === 'RECEIVE';

      let displayName = 'Giao dịch';

      switch (type) {
        case 'DEPOSIT':
          displayName = `Nạp tiền qua ${tx.paymentMethod}`;
          break;
        case 'PAYMENT':
          displayName = 'Thanh toán đơn hàng';
          break;
        case 'REFUND':
          displayName = 'Hoàn tiền đơn hàng';
          break;
        case 'WITHDRAW':
          displayName = 'Rút tiền';
          break;
      }

      return {
        _id: tx._id,
        type,
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

  async createEscrowTransaction({
    userId,
    orderId,
    amount,
    paymentMethod = 'STRIPE',
  }: {
    userId: string;
    orderId: string;
    amount: number;
    paymentMethod?: string;
  }) {
    const userObjectId = new Types.ObjectId(userId);
    const orderObjectId = new Types.ObjectId(orderId);

    const exists = await this.txModel.findOne({
      externalId: `ESCROW_${orderId}`,
    });

    if (exists) return exists;

    await this.walletModel.updateOne(
      { userId: userObjectId },
      {
        $inc: { pendingBalance: amount },
        $setOnInsert: { balance: 0, totalEarning: 0 },
      },
      { upsert: true },
    );

    return this.txModel.create({
      userId: userObjectId,
      orderId: orderObjectId,
      amount: -amount,
      type: TransactionType.PAYMENT,
      status: TransactionStatus.PENDING,
      externalId: `ESCROW_${orderId}`,
      paymentMethod,
    });
  }

  async moveBalanceToEscrow({
    userId,
    orderId,
    amount,
    paymentMethod = 'WALLET',
  }: {
    userId: string;
    orderId: string;
    amount: number;
    paymentMethod?: string;
  }) {
    const userObjectId = new Types.ObjectId(userId);
    const orderObjectId = new Types.ObjectId(orderId);

    const exists = await this.txModel.findOne({
      externalId: `ESCROW_${orderId}`,
    });

    if (exists) return exists;

    const walletUpdate = await this.walletModel.updateOne(
      {
        userId: userObjectId,
        balance: { $gte: amount },
      },
      {
        $inc: { balance: -amount, pendingBalance: amount },
        $setOnInsert: { totalEarning: 0 },
      },
    );

    if (walletUpdate.modifiedCount === 0) {
      throw new BadRequestException('Insufficient balance');
    }

    return this.txModel.create({
      userId: userObjectId,
      orderId: orderObjectId,
      amount: -amount,
      type: TransactionType.PAYMENT,
      status: TransactionStatus.PENDING,
      externalId: `ESCROW_${orderId}`,
      paymentMethod,
    });
  }

  async releaseEscrow(
    orderId: string,
    customerId: string,
    taskerId: string,
    amount: number,
    paymentMethod = 'SYSTEM',
  ) {
    console.log('RELEASE ESCROW START');

    const orderObjectId = new Types.ObjectId(orderId);
    const customerObjectId = new Types.ObjectId(customerId);
    const taskerObjectId = new Types.ObjectId(taskerId);
    const taskerReleaseExternalId = `RELEASE_TASKER_${orderId}`;

    const existingRelease = await this.txModel.findOne({
      externalId: taskerReleaseExternalId,
    });

    if (existingRelease) {
      return existingRelease;
    }

    const customerUpdate = await this.walletModel.updateOne(
      {
        userId: customerObjectId,
        pendingBalance: { $gte: amount },
      },
      {
        $inc: { pendingBalance: -amount },
      },
    );

    if (customerUpdate.modifiedCount === 0) {
      throw new BadRequestException('Invalid escrow state');
    }

    await this.walletModel.updateOne(
      { userId: taskerObjectId },
      {
        $inc: { balance: amount, totalEarning: amount },
        $setOnInsert: { pendingBalance: 0 },
      },
      { upsert: true },
    );

    await this.txModel.updateOne(
      { externalId: `ESCROW_${orderId}` },
      { $set: { status: TransactionStatus.SUCCESS } },
    );

    await this.txModel.updateOne(
      { externalId: `RELEASE_CUSTOMER_${orderId}` },
      {
        $setOnInsert: {
          userId: customerObjectId,
          orderId: orderObjectId,
          amount: -amount,
          type: TransactionType.PAYMENT,
          status: TransactionStatus.SUCCESS,
          paymentMethod,
        },
      },
      { upsert: true },
    );

    await this.txModel.updateOne(
      { externalId: taskerReleaseExternalId },
      {
        $setOnInsert: {
          userId: taskerObjectId,
          orderId: orderObjectId,
          amount,
          type: TransactionType.RECEIVE,
          status: TransactionStatus.SUCCESS,
          paymentMethod,
        },
      },
      { upsert: true },
    );

    console.log('RELEASE ESCROW DONE');
  }

  async addEarning(taskerId: string, amount: number) {
    console.log('ADD EARNING:', amount);

    await this.walletModel.updateOne(
      { userId: new Types.ObjectId(taskerId) },
      {
        $inc: { balance: amount, totalEarning: amount },
        $setOnInsert: { pendingBalance: 0 },
      },
      { upsert: true },
    );

    await this.txModel.create({
      userId: new Types.ObjectId(taskerId),
      amount,
      type: TransactionType.RECEIVE,
      status: TransactionStatus.SUCCESS,
      externalId: `CASH_${Date.now()}`,
      paymentMethod: 'CASH',
    });
  }

  async refundEscrow(userId: string, amount: number) {
    const userObjectId = new Types.ObjectId(userId);

    const walletUpdate = await this.walletModel.updateOne(
      {
        userId: userObjectId,
        pendingBalance: { $gte: amount },
      },
      { $inc: { balance: amount, pendingBalance: -amount } },
    );

    if (walletUpdate.modifiedCount === 0) {
      throw new BadRequestException('Invalid escrow state');
    }

    await this.txModel.create({
      userId: userObjectId,
      amount,
      type: TransactionType.REFUND,
      status: TransactionStatus.SUCCESS,
      externalId: `REFUND_${Date.now()}_${userId}`,
      paymentMethod: 'SYSTEM',
    });
  }
}
