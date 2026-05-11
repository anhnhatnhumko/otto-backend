import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BankAccount } from './schemas/bank-account.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class BankAccountService {
  constructor(
    @InjectModel(BankAccount.name)
    private bankModel: Model<BankAccount>,
  ) {}

  async getByUser(userId: string) {
    return this.bankModel.find({ userId: new Types.ObjectId(userId) });
  }

  async create(userId: string, body: any) {
    const bank = await this.bankModel.create({
      userId: new Types.ObjectId(userId),
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      accountHolder: body.accountHolder,
    });

    return bank;
  }
}