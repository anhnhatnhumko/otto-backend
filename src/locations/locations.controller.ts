import { Controller, Get, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Province } from './province.schema';
import { Location } from './location.schema';

@Controller('locations')
export class LocationsController {

    constructor(
        @InjectModel(Province.name)
        private provinceModel: Model<Province>,

        @InjectModel(Location.name)
        private locationModel: Model<Location>,
    ) { }

    // =========================
    // GET PROVINCES
    // =========================

    @Get('provinces')
    async getProvinces() {
        return this.provinceModel.find().sort({ name: 1 });
    }

    // =========================
    // GET LOCATIONS
    // =========================

    @Get()
    async getLocations(
        @Query('provinceId') provinceId?: string,
        @Query('type') type?: string,
    ) {

        const filter: any = {};

        if (provinceId) {
            filter.provinceId = new Types.ObjectId(provinceId);
        }

        if (type) {
            filter.type = type;
        }

        return this.locationModel
            .find(filter)
            .sort({ name: 1 });
    }
}