import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt.guard';

@Controller('chat')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private chatGateway: ChatGateway,
  ) {}

  @Get('orders/:orderId/messages')
  async getMessages(
    @Param('orderId') orderId: string,
    @Query('limit') limit = '200',
  ) {
    const n = parseInt(limit as string, 10) || 200;
    const msgs = await this.chatService.findByOrderId(orderId, n);
    return msgs;
  }

  @Patch('orders/:orderId/messages/mark-read')
  async markMessagesAsRead(@Param('orderId') orderId: string) {
    return this.chatService.markOrderMessagesAsRead(orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:orderId/messages')
  async sendMessage(
    @Param('orderId') orderId: string,
    @Body() body: { text?: string },
    @CurrentUser() user: any,
  ) {
    const senderId = String(user?.userId ?? user?.sub ?? user?._id ?? '');
    const senderRole = String(user?.role ?? '').toUpperCase();
    const text = String(body?.text ?? '').trim();

    if (!orderId || !text || !senderId) {
      return { ok: false, message: 'Missing message payload' };
    }

    const msg = await this.chatGateway.processAndBroadcastChatMessage({
      orderId,
      text,
      senderId,
      senderRole,
    });

    return { ok: true, message: msg };
  }
}
