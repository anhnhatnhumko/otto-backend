import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Wallet } from './schemas/wallet.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class WalletRepository {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
  ) {}

  async findByUserId(userId: string) {
    return this.walletModel.findOne({ userId });
  }

  async createIfNotExists(userId: string) {
    return this.walletModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true },
    );
  }

  async increaseBalance(userId: Types.ObjectId, amount: number) {
    return this.walletModel.updateOne(
      { userId },
      { $inc: { balance: amount } },
    );
  }
}