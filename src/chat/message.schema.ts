import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ChatMessage extends Document {
  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  senderId: string;

  @Prop({ required: true })
  senderRole: string;

  @Prop({ required: true })
  text: string;

  @Prop({ default: false })
  read: boolean;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
