import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskerController } from './tasker.controller';
import { TaskerService } from './tasker.service';
import { User, UserSchema } from '../users/user.schema';
import { Order, OrderSchema } from '../orders/order.schema';
import { AdminModule } from '../admin/admin.module';
import { MailModule } from '../mail/mail.module';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '1d',
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    MailModule,
    AdminModule,
  ],
  controllers: [TaskerController],
  providers: [TaskerService],
  exports: [TaskerService],
})
export class TaskerModule {}