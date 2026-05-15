import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './notification.schema';
import { NotificationsGateway } from './notifications.gateway';
import { AdminGateway } from '../admin/admin.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly adminGateway: AdminGateway,
  ) {}

  async findForUser(userId: string, limit = 20) {
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async markRead(notificationId: string) {
    return this.notificationModel.updateOne(
      { _id: new Types.ObjectId(notificationId) },
      { $set: { isRead: true } },
    );
  }

  async markAllReadForUser(userId: string) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      this.logger.warn(`markAllReadForUser called with invalid userId=${userId}`);
      return { modifiedCount: 0 };
    }

    return this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true } },
    );
  }

  async createNotification(
    userId: string,
    data: {
      title: string;
      content: string;
      type?: string;
      orderId?: string;
      senderId?: string;
      senderName?: string;
    },
  ) {
    // Validate userId before creating ObjectId to avoid Mongo/Mongoose errors
    if (!userId || !Types.ObjectId.isValid(userId)) {
      this.logger.warn(`createNotification called with invalid userId=${userId}`);
      return null;
    }

    const { title, content } = this.formatNotificationText(data);

    const payload: any = {
      userId: new Types.ObjectId(userId),
      title,
      content,
      type: data.type,
      orderId: data.orderId,
      senderId: data.senderId,
      senderName: data.senderName,
      isRead: false,
    };

    const notification = new this.notificationModel(payload);
    const saved = await notification.save();

    this.notificationsGateway.emitToUser(userId, saved.toObject());

    return saved;
  }

  async deleteNotification(notificationId: string) {
    if (!notificationId || !Types.ObjectId.isValid(notificationId)) {
      this.logger.warn(`deleteNotification called with invalid id=${notificationId}`);
      return { deletedCount: 0 };
    }

    return this.notificationModel.deleteOne(
      { _id: new Types.ObjectId(notificationId) },
    );
  }

  private formatNotificationText(data: {
    title: string;
    content: string;
    type?: string;
    orderId?: string;
    senderId?: string;
    senderName?: string;
  }) {
    const senderName = String(data.senderName ?? '').trim();
    const safeContent = String(data.content ?? '').trim();

    if (data.type === 'chat_message') {
      const title = senderName
        ? ` Tin nhắn mới từ ${senderName}`
        : ` Tin nhắn mới`;

      const content = senderName
        ? `${senderName}: ${safeContent}`
        : safeContent;

      return {
        title,
        content: content.length > 120 ? `${content.slice(0, 117)}...` : content,
      };
    }

    if (data.type === 'refund') {
      return {
        title: data.title || 'Hoàn tiền đã được xử lý',
        content: safeContent || 'Tiền hoàn đã được ghi nhận vào ví của bạn.',
      };
    }

    return {
      title: data.title,
      content: safeContent,
    };
  }
}
