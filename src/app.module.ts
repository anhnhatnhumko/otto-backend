import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error('Missing MongoDB connection string. Set MONGODB_URI or MONGO_URI.');
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // MongooseModule.forRootAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     uri: config.get<string>('MONGO_URI'),
    //   }),
    // }),
    MongooseModule.forRoot(mongoUri, {
      connectionFactory: (connection) => {
        console.log('======================');
        console.log('Mongo Connected');
        console.log('HOST:', connection.host);
        console.log('DB:', connection.name);
        console.log('READY STATE:', connection.readyState);
        console.log('URI source:', process.env.MONGODB_URI ? 'MONGODB_URI' : 'MONGO_URI');
        console.log('======================');

        return connection;
      },
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
