import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class BankAccount {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop()
  bankName: string;

  @Prop()
  accountNumber: string;

  @Prop()
  accountHolder: string;
}

export const BankAccountSchema =
  SchemaFactory.createForClass(BankAccount);