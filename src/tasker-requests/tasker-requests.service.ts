import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TaskerRequest, TaskerRequestDocument } from './tasker-request.schema';
import { AdminGateway } from '../admin/admin.gateway';
import { User } from '../users/user.schema';
import { Service } from '../services/service.schema';
import { Location } from '../locations/location.schema';
import { Province } from '../locations/province.schema';

@Injectable()
export class TaskerRequestsService {
  private readonly logger = new Logger(TaskerRequestsService.name);
  constructor(
    @InjectModel(TaskerRequest.name) private model: Model<TaskerRequestDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(Location.name) private locationModel: Model<Location>,
    @InjectModel(Province.name) private provinceModel: Model<Province>,
    private readonly adminGateway: AdminGateway,
  ) {}

  async create(payload: { formData: any; services: string[] }) {
    const doc = new this.model({ formData: payload.formData, services: payload.services });
    const saved = await doc.save();

    // Emit realtime event to admins
    try {
      // Enrich the saved document so admins receive readable names (services, district, city)
      const [enriched] = await this.enrichRequests([saved.toObject()]);
      const payload = enriched || saved.toObject();
      // Preferred dedicated emitters
      if (this.adminGateway && typeof this.adminGateway.emitTaskerRequestCreated === 'function') {
        this.adminGateway.emitTaskerRequestCreated(payload);
      }
      // Backwards-compatible generic event
      this.adminGateway.emitToAdmins('admin:new-tasker-request', payload);
      this.logger.log('Emitted admin tasker-request created events');
    } catch (err) {
      this.logger.warn('Failed to emit admin:new-tasker-request: ' + err);
    }

    return saved;
  }

  async findAll(limit = 100) {
    const list = await this.model
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
    return this.enrichRequests(list);
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const item = await this.model.findById(id).lean().exec();
    if (!item) return null;
    const [enriched] = await this.enrichRequests([item]);
    return enriched;
  }

  async approve(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const item = await this.model.findById(id).exec();
    if (!item) return null;
    item.status = 'approved';
    await item.save();

    const [enriched] = await this.enrichRequests([item.toObject()]);
    const payload = enriched || item.toObject();

    try {
      if (this.adminGateway && typeof this.adminGateway.emitTaskerRequestUpdated === 'function') {
        this.adminGateway.emitTaskerRequestUpdated(payload);
      }
      this.adminGateway.emitToAdmins('admin:tasker-request-updated', payload);
      this.logger.log(`Emitted tasker-request-updated for ${id}`);
    } catch (err) {
      this.logger.warn('Failed to emit tasker-request-updated: ' + err);
    }

    return payload;
  }

  async reject(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const item = await this.model.findById(id).lean().exec();
    if (!item) return null;

    await this.model.deleteOne({ _id: new Types.ObjectId(id) }).exec();

    try {
      if (this.adminGateway && typeof this.adminGateway.emitTaskerRequestDeleted === 'function') {
        this.adminGateway.emitTaskerRequestDeleted(id);
      }
      this.adminGateway.emitToAdmins('admin:tasker-request-deleted', { id, _id: id });
      this.logger.log(`Emitted tasker-request-deleted for ${id}`);
    } catch (err) {
      this.logger.warn('Failed to emit tasker-request-deleted: ' + err);
    }

    return { success: true };
  }

  async checkContact(email?: string, phone?: string) {
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();
    const normalizedPhone = String(phone || '')
      .trim()
      .replace(/\s+/g, '');

    if (!normalizedEmail && !normalizedPhone) {
      return {
        emailExists: false,
        phoneExists: false,
        requestExists: false,
      };
    }

    const safeEmail = this.escapeRegex(normalizedEmail);

    const [userByEmail, reqByEmail, userByPhone, reqByPhone] = await Promise.all([
      normalizedEmail
        ? this.userModel
            .findOne({ email: { $regex: `^${safeEmail}$`, $options: 'i' } })
            .lean()
            .exec()
        : null,
      normalizedEmail
        ? this.model
            .findOne({
              'formData.email': { $regex: `^${safeEmail}$`, $options: 'i' },
            })
            .lean()
            .exec()
        : null,
      normalizedPhone
        ? this.userModel.findOne({ phone: normalizedPhone }).lean().exec()
        : null,
      normalizedPhone
        ? this.model.findOne({ 'formData.phone': normalizedPhone }).lean().exec()
        : null,
    ]);

    const emailExists = !!userByEmail || !!reqByEmail;
    const phoneExists = !!userByPhone || !!reqByPhone;

    return {
      emailExists,
      phoneExists,
      requestExists: !!reqByEmail || !!reqByPhone,
    };
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async enrichRequests(list: any[]) {
    if (!Array.isArray(list) || list.length === 0) return [];

    const serviceIds = new Set<string>();
    const districtIds = new Set<string>();
    const provinceIds = new Set<string>();

    for (const item of list) {
      const services = Array.isArray(item?.services) ? item.services : [];
      for (const serviceId of services) {
        const value = String(serviceId || '').trim();
        if (Types.ObjectId.isValid(value)) {
          serviceIds.add(value);
        }
      }

      const district = String(item?.formData?.district || '').trim();
      if (Types.ObjectId.isValid(district)) {
        districtIds.add(district);
      }

      const city = String(item?.formData?.city || '').trim();
      if (Types.ObjectId.isValid(city)) {
        provinceIds.add(city);
      }
    }

    const [serviceDocs, districtDocs, provinceDocs] = await Promise.all([
      serviceIds.size > 0
        ? this.serviceModel
            .find({ _id: { $in: Array.from(serviceIds, (id) => new Types.ObjectId(id)) } })
            .lean()
            .exec()
        : [],
      districtIds.size > 0
        ? this.locationModel
            .find({ _id: { $in: Array.from(districtIds, (id) => new Types.ObjectId(id)) } })
            .lean()
            .exec()
        : [],
      provinceIds.size > 0
        ? this.provinceModel
            .find({ _id: { $in: Array.from(provinceIds, (id) => new Types.ObjectId(id)) } })
            .lean()
            .exec()
        : [],
    ]);

    const serviceMap = new Map<string, string>(
      serviceDocs.map((doc: any) => [String(doc._id), String(doc.name)] as [string, string]),
    );
    const districtMap = new Map<string, string>(
      districtDocs.map((doc: any) => [String(doc._id), String(doc.name)] as [string, string]),
    );
    const provinceMap = new Map<string, string>(
      provinceDocs.map((doc: any) => [String(doc._id), String(doc.name)] as [string, string]),
    );

    return list.map((item) => {
      const rawServices = Array.isArray(item?.services) ? item.services : [];
      const mappedServices = rawServices.map((serviceId: any) => {
        const key = String(serviceId || '').trim();
        return serviceMap.get(key) || key;
      });

      const rawDistrict = String(item?.formData?.district || '').trim();
      const rawCity = String(item?.formData?.city || '').trim();

      return {
        ...item,
        services: mappedServices,
        formData: {
          ...item.formData,
          district: districtMap.get(rawDistrict) || rawDistrict,
          city: provinceMap.get(rawCity) || rawCity,
        },
      };
    });
  }
}
