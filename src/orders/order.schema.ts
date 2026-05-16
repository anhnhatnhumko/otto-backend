import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';
import { OrderStatus } from './order-status.enum';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  taskerId: Types.ObjectId | null;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: null, index: true })
  offeredTaskers: Types.ObjectId[] | null;

  @Prop({ default: 0 })
  offerRound: number;

  @Prop({ index: true })
  offerExpiresAt: Date;

  @Prop({ type: [Types.ObjectId], default: [] })
  rejectedTaskers: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true, index: true })
  serviceId: Types.ObjectId;

  @Prop({
    type: {
      name: String,
      pricePerHour: Number,
    },
    required: true,
  })
  serviceSnapshot: {
    name: string;
    pricePerHour: number;
  };

  @Prop({ required: true })
  scheduleTime: Date;

  @Prop({ required: true, type: Date, index: true })
  startTime: Date;

  @Prop({ required: true, type: Date, index: true })
  endTime: Date;

  @Prop({ index: true })
  overdueWarningSentAt?: Date;

  @Prop({ required: true })
  totalHours: number;

  @Prop({ required: true })
  totalPrice: number;

  @Prop({ type: Types.ObjectId, ref: 'Province', required: true, index: true })
  provinceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Ward', required: true, index: true })
  wardId: Types.ObjectId;

  @Prop()
  address?: string;

  @Prop({ required: true })
  addressDetail: string;

  @Prop()
  note: string;

  @Prop({
    type: String,
    enum: OrderStatus,
    default: OrderStatus.SEARCHING,
    index: true,
  })
  status: OrderStatus;

  @Prop()
  paymentTransactionId?: string;

  @Prop()
  completedAt?: Date;

  @Prop()
  finishedAt?: Date;

  @Prop()
  paidAt?: Date;

  @Prop({ min: 1, max: 5 })
  rating?: number;

  @Prop()
  review?: string;

  @Prop({ enum: ['cash', 'wallet', 'stripe'], required: true, default: 'cash' })
  paymentMethod: string;

  @Prop({ default: false })
  isRefunded: boolean;

  createdAt?: Date;
  updatedAt?: Date;

}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ customerId: 1, startTime: 1, endTime: 1 });
