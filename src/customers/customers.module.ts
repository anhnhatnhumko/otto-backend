import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CustomersService } from './customers.service';
import { CustomersController, PromotionsController } from './customers.controller';
import { User, UserSchema } from '../users/user.schema';
import { Order, OrderSchema } from '../orders/order.schema';
import { Service, ServiceSchema } from '../services/service.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRATION || '7d') as any,
      },
    }),
    MailModule,
  ],
  controllers: [CustomersController, PromotionsController],
  providers: [CustomersService],
})
export class CustomersModule {}
