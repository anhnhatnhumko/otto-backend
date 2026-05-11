import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../users/user.schema';
import { Model, Types } from 'mongoose';

function parseCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) return {} as Record<string, string>;
  return cookieHeader.split(';').map(c => c.trim()).reduce((acc: any, cur) => {
    const [k, ...v] = cur.split('=');
    acc[k] = decodeURIComponent((v || []).join('='));
    return acc;
  }, {} as Record<string, string>);
}

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private ordersService: OrdersService,
    private notificationsService: NotificationsService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  handleConnection(client: Socket) {
    // Try to extract token from auth, query or cookie
    const tokenFromAuth = String(client.handshake.auth?.token ?? '');
    const tokenFromQuery = String(client.handshake.query?.token ?? '');
    const cookieHeader = String((client.handshake.headers?.cookie) ?? '');
    const cookies = parseCookie(cookieHeader || undefined);
    const tokenFromCookie = String(cookies['accessToken'] ?? '');
    const token = tokenFromAuth || tokenFromQuery || tokenFromCookie;

    if (!token) {
      this.logger.debug(`Socket ${client.id} missing token — disconnecting`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      const userId = String(payload?.sub ?? payload?.userId ?? '');
      const role = String(payload?.role ?? '').toUpperCase();
      client.data.user = { userId, role };
      this.logger.debug(`Socket connected user=${userId} role=${role} id=${client.id}`);
    } catch (err) {
      this.logger.warn(`Socket ${client.id} provided invalid token — disconnecting`);
      client.disconnect(true);
      return;
    }
  }

  @SubscribeMessage('order:join')
  handleOrderJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { orderId?: string; userId?: string },
  ) {
    const orderId = String(payload?.orderId ?? '');
    if (!orderId) return;
    const roomName = `order-${orderId}`;
    client.join(roomName);
    this.logger.debug(`Socket ${client.id} joined ${roomName}`);
  }

  @SubscribeMessage('chat:message')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { orderId?: string; text?: string },
  ) {
    const orderId = String(payload?.orderId ?? '');
    const text = String(payload?.text ?? '').trim();
    if (!orderId || !text) return;

    // 🔥 FIX: Get userId and role from client.data (set in handleConnection)
    const senderId = String(client.data.user?.userId ?? '');
    const senderRole = String(client.data.user?.role ?? '');

    if (!senderId) {
      this.logger.warn(`Chat message without sender ID`);
      return;
    }

    // Create message in DB
    const msg = await this.chatService.createMessage({
      orderId,
      senderId,
      senderRole,
      text,
    });

    // Broadcast to all clients in this order's room
    const roomName = `order-${orderId}`;
    this.server.to(roomName).emit('chat:message', msg);

    // Create notification for the recipient
    // Fetch sender's full name from User collection
    let senderName = 'Someone';
    if (senderId && Types.ObjectId.isValid(senderId)) {
      const sender = await this.userModel.findById(senderId).lean().exec();
      if (sender && sender.fullName) {
        senderName = sender.fullName;
      }
    }

    try {
      // Use internal orders service to fetch order
      const order = await this.ordersService.findById(orderId, { role: 'ADMIN' });
      if (!order) {
        this.logger.warn(`Order ${orderId} not found for notification`);
        return;
      }

      // 🔥 FIX: Safely extract recipient ID
      const safeExtractId = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === 'string' && Types.ObjectId.isValid(value)) return value;
        if (value?._id && Types.ObjectId.isValid(value._id)) return String(value._id);
        if (value?.id && Types.ObjectId.isValid(value.id)) return String(value.id);
        return null;
      };

      let recipientId: string | null = null;
      let notificationTitle = '';

      if (senderRole === 'CUSTOMER') {
        // Recipient is tasker
        recipientId = safeExtractId(order.taskerId);
        notificationTitle = `Tin nhắn từ khách hàng`;
      } else if (senderRole === 'TASKER') {
        // Recipient is customer
        recipientId = safeExtractId(order.customerId);
        notificationTitle = `Tin nhắn từ người thực hiện`;
      }

      if (!recipientId) {
        this.logger.warn(
          `Skip notification - invalid recipientId for order=${orderId}, sender=${senderId}, role=${senderRole}`,
        );
        return;
      }

      this.logger.debug(
        `Creating notification for recipient=${recipientId}, order=${orderId}, sender=${senderId}`,
      );

      await this.notificationsService.createNotification(recipientId, {
        title: notificationTitle,
        content: text.substring(0, 100),
        type: 'chat_message',
        orderId,
        senderId,
        senderName,
      });
    } catch (err) {
      this.logger.error(`Failed to create notification: ${err.message}`);
    }
  }
}
