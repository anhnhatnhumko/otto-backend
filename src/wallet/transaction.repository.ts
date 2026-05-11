import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Transaction } from './schemas/transaction.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectModel(Transaction.name)
    private txModel: Model<Transaction>,
  ) {}

  create(data: Partial<Transaction>) {
    return this.txModel.create(data);
  }

  findByUser(userId: string) {
    return this.txModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 });
  }

  update(id: string, data: Partial<Transaction>) {
    return this.txModel.findByIdAndUpdate(id, data, { new: true });
  }
}