import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './notification.schema';
import { NotificationsGateway } from './notifications.gateway';
import { AdminGateway } from '../admin/admin.gateway';

type NotificationTextInput = {
  title?: string;
  content?: string;
  senderName?: string;
  type?: string;
  orderId?: string;
  senderId?: string;
};

type NotificationRecord = NotificationTextInput & {
  _id?: unknown;
  userId?: unknown;
  isRead?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

const MOJIBAKE_PATTERN =
  /[\u00c3\u00c2\u00c4\u00c5\u00c6\u00d0\u00d1\u00d2\u00d3\u00d4\u00d5\u00d6\u00d8\u00d9\u00da\u00db\u00dc\u00dd\u00de\u00df\u00e2\u00f0\u00ef\ufffd]/;
const BROKEN_INLINE_QUESTION_PATTERN = /[\p{L}]\?[\p{L}]/u;

const CP1252_EXTENDED_BYTES: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function decodeCp1252Utf8(value: string) {
  const bytes = Uint8Array.from(
    Array.from(value, (char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      if (codePoint <= 0xff) {
        return codePoint;
      }

      return CP1252_EXTENDED_BYTES[codePoint] ?? 0x3f;
    }),
  );

  return new TextDecoder('utf-8').decode(bytes);
}

function normalizeVietnameseText(value?: string | null) {
  const input = String(value ?? '');

  if (!input || !MOJIBAKE_PATTERN.test(input)) {
    return input;
  }

  let normalized = input;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!MOJIBAKE_PATTERN.test(normalized)) {
      break;
    }

    try {
      const escapedDecoded = decodeURIComponent(escape(normalized));
      if (escapedDecoded && escapedDecoded !== normalized) {
        normalized = escapedDecoded;
        if (!MOJIBAKE_PATTERN.test(normalized)) {
          break;
        }
      }
    } catch {
      // Ignore and continue to the TextDecoder fallback.
    }

    const decoded = decodeCp1252Utf8(normalized);
    if (!decoded || decoded === normalized) {
      break;
    }

    normalized = decoded;
  }

  return normalized;
}

function isBrokenNotificationText(value?: string | null) {
  const normalized = normalizeVietnameseText(value);
  return (
    Boolean(normalized) &&
    (MOJIBAKE_PATTERN.test(normalized) ||
      BROKEN_INLINE_QUESTION_PATTERN.test(normalized))
  );
}

function getFallbackTitleByType(type: string, senderName: string) {
  switch (type) {
    case 'chat_message':
      return senderName ? `Tin nhắn mới từ ${senderName}` : 'Tin nhắn mới';
    case 'order_accepted':
      return 'Đơn hàng được nhận';
    case 'order_completed_confirmation':
      return 'Công việc đã hoàn thành';
    case 'order_completed':
      return 'Đơn hàng hoàn thành';
    case 'order_cancelled':
      return 'Đơn hàng đã bị hủy';
    case 'order_kept':
      return 'Đơn hàng được giữ lại';
    case 'order_overdue_warning':
      return 'Đơn hàng sắp quá hạn';
    case 'refund':
      return 'Hoàn tiền đã được xử lý';
    default:
      return '';
  }
}

function getFallbackContentByType(type: string, senderName: string) {
  switch (type) {
    case 'chat_message':
      return senderName
        ? `${senderName} đã gửi một tin nhắn mới.`
        : 'Bạn có một tin nhắn mới.';
    case 'order_accepted':
      return senderName
        ? `${senderName} đã nhận đơn hàng của bạn.`
        : 'Tasker đã nhận đơn hàng của bạn.';
    case 'order_completed_confirmation':
      return senderName
        ? `${senderName} đã hoàn thành công việc. Vui lòng xác nhận.`
        : 'Tasker đã hoàn thành công việc. Vui lòng xác nhận.';
    case 'order_completed':
      return 'Đơn hàng của bạn đã hoàn thành. Vui lòng kiểm tra email để xem hóa đơn.';
    case 'order_cancelled':
      return senderName
        ? `Đơn hàng đã bị hủy bởi ${senderName}.`
        : 'Đơn hàng đã bị hủy.';
    case 'order_kept':
      return 'Khách hàng đã quyết định giữ lại đơn hàng quá hạn. Vui lòng bắt đầu làm ngay.';
    case 'order_overdue_warning':
      return 'Tasker chưa bắt đầu công việc sau giờ hẹn. Vui lòng kiểm tra đơn hàng của bạn.';
    case 'refund':
      return 'Tiền hoàn đã được ghi nhận vào ví của bạn.';
    default:
      return '';
  }
}

function normalizeNotificationRecord<T extends NotificationRecord | null | undefined>(
  notification: T,
): T {
  if (!notification) {
    return notification;
  }

  const type = String(notification.type ?? '').toLowerCase();
  const senderName = normalizeVietnameseText(notification.senderName).trim();
  const normalizedTitle = normalizeVietnameseText(notification.title);
  const normalizedContent = normalizeVietnameseText(notification.content);
  const fallbackTitle = getFallbackTitleByType(type, senderName);
  const fallbackContent = getFallbackContentByType(type, senderName);

  return {
    ...notification,
    title:
      !normalizedTitle || isBrokenNotificationText(normalizedTitle)
        ? fallbackTitle || normalizedTitle
        : normalizedTitle,
    content:
      !normalizedContent || isBrokenNotificationText(normalizedContent)
        ? fallbackContent || normalizedContent
        : normalizedContent,
    senderName,
  } as T;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly adminGateway: AdminGateway,
  ) {}

  async findForUser(userId: string, limit = 20) {
    const items = await this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return items.map((item) => normalizeNotificationRecord(item));
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
    if (!userId || !Types.ObjectId.isValid(userId)) {
      this.logger.warn(`createNotification called with invalid userId=${userId}`);
      return null;
    }

    const { title, content, senderName } = this.formatNotificationText(data);

    const payload: any = {
      userId: new Types.ObjectId(userId),
      title,
      content,
      type: data.type,
      orderId: data.orderId,
      senderId: data.senderId,
      senderName,
      isRead: false,
    };

    const notification = new this.notificationModel(payload);
    const realtimeNotification = normalizeNotificationRecord(notification.toObject());

    this.notificationsGateway.emitToUser(userId, realtimeNotification);

    const saved = await notification.save();
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

  private formatNotificationText(data: NotificationTextInput) {
    const normalized = normalizeNotificationRecord({
      title: data.title,
      content: data.content,
      senderName: data.senderName,
      type: data.type,
    });

    let title = String(normalized.title ?? data.title ?? '').trim();
    let content = String(normalized.content ?? data.content ?? '').trim();
    const senderName = String(normalized.senderName ?? data.senderName ?? '').trim();

    if (data.type === 'chat_message' && content.length > 120) {
      content = `${content.slice(0, 117)}...`;
    }

    if (data.type === 'refund') {
      title ||= 'Hoàn tiền đã được xử lý';
      content ||= 'Tiền hoàn đã được ghi nhận vào ví của bạn.';
    }

    return {
      title,
      content,
      senderName,
    };
  }
}
