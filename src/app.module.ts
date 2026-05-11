import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { ServicesModule } from './services/services.module';
import { LocationsModule } from './locations/locations.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentModule } from './payments/payments.module';
import { UploadModule } from './avatar/upload.module';
import { UserModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { ChatModule } from './chat/chat.module';
import { CustomersModule } from './customers/customers.module';
import { TaskerModule } from './tasker/tasker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
    }),

    ScheduleModule.forRoot(),
    AuthModule,
    // Notifications
    NotificationsModule,
    OrdersModule,
    ServicesModule,
    LocationsModule,
    PaymentModule,
    UploadModule,
    UserModule,
    AdminModule,
    TaskerModule,
    // Chat
    ChatModule,
    CustomersModule,
  ],
})
export class AppModule { }
