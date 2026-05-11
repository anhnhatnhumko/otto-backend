import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { Service, ServiceSchema } from './service.schema';
import { Order, OrderSchema } from '../orders/order.schema';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    AdminModule,
  ],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [
    MongooseModule, // để OrderModule dùng ServiceModel
  ],
})
export class ServicesModule {}
