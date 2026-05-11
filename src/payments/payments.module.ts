import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Order, OrderSchema } from '../orders/order.schema';
import { PaymentService } from './payments.service';
import { PaymentController } from './payments.controller';
import { WalletModule } from 'src/wallet/wallet.module';
import { StripeModule } from './stripe.module';
import { OrdersModule } from 'src/orders/orders.module';
import { PaymentOrchestratorModule } from './payment-orchestrator.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
    ]),
    WalletModule,
    StripeModule,
    OrdersModule,
    PaymentOrchestratorModule,
    MailModule,
  ],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [StripeModule],
})
export class PaymentModule {}
