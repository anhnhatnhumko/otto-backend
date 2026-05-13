import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailModule } from 'src/mail/mail.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { Order, OrderSchema } from 'src/orders/order.schema';
import { OrdersModule } from 'src/orders/orders.module';
import { User, UserSchema } from 'src/users/user.schema';
import { Notification, NotificationSchema } from 'src/notifications/notification.schema';
import {
  Transaction,
  TransactionSchema,
} from 'src/wallet/schemas/transaction.schema';
import { Wallet, WalletSchema } from 'src/wallet/schemas/wallet.schema';
import { WalletModule } from 'src/wallet/wallet.module';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { StripeModule } from './stripe.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Wallet.name, schema: WalletSchema },
    ]),
    WalletModule,
    forwardRef(() => OrdersModule),
    MailModule,
    NotificationsModule,
    StripeModule,
  ],
  providers: [PaymentOrchestratorService],
  exports: [PaymentOrchestratorService],
})
export class PaymentOrchestratorModule {}
