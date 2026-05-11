import { Controller, Get, Param, Query, Patch } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

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
}
