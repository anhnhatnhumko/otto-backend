import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

import { User, UserSchema } from '../users/user.schema';
import { Order, OrderSchema } from '../orders/order.schema';
import { Service, ServiceSchema } from '../services/service.schema';
import { Transaction, TransactionSchema } from 'src/wallet/schemas/transaction.schema';
import { AdminGateway } from './admin.gateway';
import { LocationsModule } from '../locations/locations.module';
import { MailModule } from '../mail/mail.module';
import { UploadModule } from '../avatar/upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    LocationsModule,
    MailModule,
    // provide upload service so admin can upload avatars when creating taskers
    UploadModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGateway],
  exports: [AdminService, AdminGateway],
})
export class AdminModule {}
