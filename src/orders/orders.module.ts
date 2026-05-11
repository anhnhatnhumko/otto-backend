import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './order.schema';
import { Service, ServiceSchema } from '../services/service.schema';
import { User, UserSchema } from '../users/user.schema';
import { ChatMessage, ChatMessageSchema } from '../chat/message.schema';
// import { MatchingModule } from '../matching/matching.module';
import { OrderTimeoutService } from './order.timeout.service';
import { PaymentOrchestratorModule } from 'src/payments/payment-orchestrator.module';
import { AdminModule } from 'src/admin/admin.module';
import { MailModule } from 'src/mail/mail.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: User.name, schema: UserSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
    forwardRef(() => PaymentOrchestratorModule),
    forwardRef(() => AdminModule),
    forwardRef(() => MailModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderTimeoutService],
  exports: [OrdersService],
})
export class OrdersModule {}
