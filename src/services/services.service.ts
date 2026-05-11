import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Service, ServiceDocument } from './service.schema';
import { Order, OrderDocument } from '../orders/order.schema';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AdminGateway } from 'src/admin/admin.gateway';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name)
    private serviceModel: Model<ServiceDocument>,
    @InjectModel(Order.name)
    private orderModel: Model<OrderDocument>,
    private adminGateway: AdminGateway,
  ) {}

  // CREATE
  async create(dto: CreateServiceDto) {
    const service = await this.serviceModel.create({
      ...dto,
      pricePerHour: dto.price,
    });
    this.adminGateway.emitServiceCreated(service);
    return service;
  }

  // READ – all active services
  async findAll(includeInactive = false) {
    const services = await this.serviceModel
      .find(includeInactive ? {} : { isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    // Get booking counts for each service
    const result = await Promise.all(
      services.map(async (service) => {
        const bookingCount = await this.orderModel.countDocuments({
          serviceId: service._id,
        });
        return {
          ...service,
          bookings: bookingCount,
        };
      }),
    );

    return result;
  }

  // READ – by id
  async findById(id: string) {
    const service = await this.serviceModel.findById(id);
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  // UPDATE
  async update(id: string, dto: UpdateServiceDto) {
    const updatePayload = {
      ...dto,
      ...(typeof dto.price === 'number' ? { pricePerHour: dto.price } : {}),
    };

    const service = await this.serviceModel.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true, runValidators: true },
    );
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    this.adminGateway.emitServiceUpdated(service);
    return service;
  }

  // DELETE (soft delete)
  async remove(id: string) {
    const service = await this.serviceModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    this.adminGateway.emitServiceDeleted(id);
    return service;
  }

  async setActive(id: string, isActive: boolean) {
    const service = await this.serviceModel.findByIdAndUpdate(
      id,
      { isActive },
      { new: true },
    );
    if (!service) throw new NotFoundException('Service not found');

    this.adminGateway.emitServiceUpdated(service);

    return service;
  }
}
