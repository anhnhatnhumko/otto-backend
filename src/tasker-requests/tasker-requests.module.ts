import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskerRequest, TaskerRequestSchema } from './tasker-request.schema';
import { TaskerRequestsService } from './tasker-requests.service';
import { TaskerRequestsController } from './tasker-requests.controller';
import { AdminModule } from '../admin/admin.module';
import { User, UserSchema } from '../users/user.schema';
import { Service, ServiceSchema } from '../services/service.schema';
import { Location, LocationSchema } from '../locations/location.schema';
import { Province, ProvinceSchema } from '../locations/province.schema';

@Module({
  imports: [
    AdminModule,
    MongooseModule.forFeature([
      { name: TaskerRequest.name, schema: TaskerRequestSchema },
      { name: User.name, schema: UserSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Location.name, schema: LocationSchema },
      { name: Province.name, schema: ProvinceSchema },
    ]),
  ],
  providers: [TaskerRequestsService],
  controllers: [TaskerRequestsController],
  exports: [TaskerRequestsService],
})
export class TaskerRequestsModule {}
