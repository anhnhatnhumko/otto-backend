import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Province, ProvinceSchema } from './province.schema';
import { Location, LocationSchema } from './location.schema';

import { LocationsController } from './locations.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Province.name, schema: ProvinceSchema },
      { name: Location.name, schema: LocationSchema },
      { name: 'Ward', schema: LocationSchema }, // Ward alias cho Location
    ]),
  ],
  controllers: [LocationsController],
  exports: [MongooseModule],
})
export class LocationsModule {}