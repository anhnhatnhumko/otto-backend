import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class FakeBank {
  @Prop()
  bankName: string;

  @Prop()
  accountNumber: string;

  @Prop({ default: 0 })
  balance: number;
}

export const FakeBankSchema =
  SchemaFactory.createForClass(FakeBank);