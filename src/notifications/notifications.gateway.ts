import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const SOCKET_ALLOWED_ORIGINS = [
  'https://ottohome.online',
  'https://www.ottohome.online',
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19000',
  'http://localhost:19006',
  'http://127.0.0.1',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19000',
  'http://127.0.0.1:19006',
];

function parseCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) return {} as Record<string, string>;
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .reduce((acc: any, current) => {
      const [key, ...values] = current.split('=');
      acc[key] = decodeURIComponent((values || []).join('='));
      return acc;
    }, {} as Record<string, string>);
}

@WebSocketGateway({
  cors: {
    origin: SOCKET_ALLOWED_ORIGINS,
    credentials: true,
  }
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) { }

  handleConnection(client: Socket) {
    const tokenFromAuth = String(client.handshake.auth?.token ?? '');
    const tokenFromQuery = String(client.handshake.query?.token ?? '');
    const cookieHeader = String(client.handshake.headers?.cookie ?? '');
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

      if (!userId) {
        client.disconnect(true);
        return;
      }

      client.join(`user-${userId}`);
      client.data.user = { userId };
      this.logger.debug(`Socket ${client.id} joined user-${userId}`);
    } catch (error) {
      this.logger.warn(`Socket ${client.id} provided invalid token — disconnecting`);
      client.disconnect(true);
    }
  }

  emitToUser(userId: string, notification: any) {
    if (!userId) return;

    this.server.to(`user-${userId}`).emit('notification:new', notification);
  }
}
