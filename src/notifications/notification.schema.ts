import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: false })
  isRead: boolean;

  // Optional fields for chat messages
  @Prop()
  type?: string; // 'chat_message', 'refund', etc.

  @Prop()
  orderId?: string;

  @Prop()
  senderId?: string;

  @Prop()
  senderName?: string;
}

export const NotificationSchema =
  SchemaFactory.createForClass(Notification);
