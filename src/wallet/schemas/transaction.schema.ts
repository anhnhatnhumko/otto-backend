import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  WITHDRAW = 'WITHDRAW',
  RECEIVE = 'RECEIVE',
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId: Types.ObjectId;

  @Prop()
  amount: number;

  @Prop({ enum: TransactionStatus })
  status: TransactionStatus;

  @Prop({ unique: true })
  externalId: string; // app_trans_id

  @Prop({ enum: TransactionType })
  type: TransactionType;

  @Prop()
  paymentMethod: string;

  @Prop()
  otpCode: string;

  @Prop()
  otpExpires: Date;

  @Prop({ default: false })
  isOtpVerified: boolean;

  // For withdraw transactions
  @Prop()
  bankName: string;

  @Prop()
  accountNumber: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ userId: 1, createdAt: -1 });