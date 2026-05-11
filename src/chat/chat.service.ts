import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatMessage } from './message.schema';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(ChatMessage.name) private chatModel: Model<ChatMessage>,
  ) {}

  async createMessage(payload: {
    orderId: string;
    senderId: string;
    senderRole: string;
    text: string;
  }) {
    const doc = await this.chatModel.create(payload as any);
    this.logger.debug(`Created chat message for order ${payload.orderId}`);
    return doc;
  }

  async findByOrderId(orderId: string, limit = 200) {
    return this.chatModel
      .find({ orderId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async markOrderMessagesAsRead(orderId: string) {
    const result = await this.chatModel.updateMany(
      {
        orderId,
        senderRole: 'CUSTOMER',
        read: false,
      },
      { $set: { read: true } }
    );
    this.logger.debug(`Marked ${result.modifiedCount} messages as read for order ${orderId}`);
    return { modifiedCount: result.modifiedCount };
  }
}
