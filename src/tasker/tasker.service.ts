import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.schema';
import { Order } from '../orders/order.schema';
import { OrderStatus } from '../orders/order-status.enum';
import { AdminGateway } from 'src/admin/admin.gateway';
import { MailService } from '../mail/mail.service';

@Injectable()
export class TaskerService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private adminGateway: AdminGateway,
    private mailService: MailService,
    private jwtService: JwtService,
  ) {}

  // ==========================
  // PROFILE
  // ==========================
  async getProfile(taskerId: string) {
    const tasker = await this.userModel
      .findById(taskerId)
      .populate('skills')
      .populate('provinceId')
      .populate('wardId')
      .populate('wardIds');

    if (!tasker) throw new NotFoundException('Tasker not found');

    return tasker;
  }

  // ==========================
  // UPDATE PROFILE
  // ==========================
  async updateProfile(taskerId: string, dto: any) {
    try {
      const tasker = await this.userModel.findById(taskerId);

      if (!tasker) {
        throw new NotFoundException('Tasker not found');
      }

      const fullName = String(dto.fullName || '').trim();
      const email = String(dto.email || '').trim();
      const phone = String(dto.phone || '').trim();
      const idCard = String(dto.idCard || '').trim();
      const provinceId = String(dto.provinceId || '').trim();
      const wardIds = Array.isArray(dto.wardIds)
        ? dto.wardIds.map((wardId) => String(wardId).trim()).filter((wardId) => Types.ObjectId.isValid(wardId))
        : String(dto.wardId || '')
            .trim()
            ? [String(dto.wardId).trim()].filter((wardId) => Types.ObjectId.isValid(wardId))
            : [];
      const skills = Array.isArray(dto.skills)
        ? dto.skills.map((skillId) => String(skillId).trim()).filter((skillId) => Types.ObjectId.isValid(skillId))
        : [];

      if (!fullName) {
        throw new BadRequestException('Họ tên không được để trống');
      }

      if (!email) {
        throw new BadRequestException('Email không được để trống');
      }

      if (!phone) {
        throw new BadRequestException('Số điện thoại không được để trống');
      }

      if (!provinceId || !Types.ObjectId.isValid(provinceId)) {
        throw new BadRequestException('Vui lòng chọn tỉnh/thành hợp lệ');
      }

      if (wardIds.length === 0) {
        throw new BadRequestException('Vui lòng chọn ít nhất 1 xã/phường hợp lệ');
      }

      if (skills.length === 0) {
        throw new BadRequestException('Vui lòng chọn ít nhất 1 dịch vụ');
      }

      tasker.fullName = fullName;
      tasker.email = email;
      tasker.phone = phone;
      tasker.idCard = idCard || undefined;
      if (typeof dto.address === 'string') {
        const address = dto.address.trim();
        if (address) {
          tasker.address = address;
        }
      }
      tasker.provinceId = new Types.ObjectId(provinceId);
      tasker.wardIds = wardIds.map((wardId) => new Types.ObjectId(wardId));
      tasker.wardId = new Types.ObjectId(wardIds[0]);
      tasker.skills = skills.map((skillId) => new Types.ObjectId(skillId));
      if (dto.currentLocation) {
        tasker.currentLocation = dto.currentLocation;
      }

      await tasker.save();

      const updatedTasker = await this.userModel
        .findById(taskerId)
        .populate('skills')
        .populate('provinceId')
        .populate('wardId')
        .populate('wardIds');

      if (updatedTasker) {
        this.adminGateway.emitTaskerUpdated(updatedTasker);
      }

      return updatedTasker;
    } catch (error: any) {
      console.error('❌ Lỗi cập nhật profile:', error);
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new BadRequestException(
          `${field} đã được sử dụng bởi tài khoản khác`,
        );
      }
      throw error;
    }
  }

  // ==========================
  // ONLINE / OFFLINE
  // ==========================
  async setOnline(taskerId: string) {
    const tasker = await this.userModel.findByIdAndUpdate(
      taskerId,
      {
        isOnline: true,
        isAvailable: true,
      },
      { new: true },
    );

    if (tasker) {
      this.adminGateway.emitTaskerUpdated(tasker);
    }

    return tasker;
  }

  async setOffline(taskerId: string) {
    const tasker = await this.userModel.findByIdAndUpdate(
      taskerId,
      { isOnline: false },
      { new: true },
    );

    if (tasker) {
      this.adminGateway.emitTaskerUpdated(tasker);
    }

    return tasker;
  }

  // ==========================
  // ACTIVE ORDER
  // ==========================
  async getActiveOrder(taskerId: string) {
    return this.orderModel.findOne({
      taskerId,
      status: { $in: [OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS] },
    });
  }

  // ==========================
  // HISTORY
  // ==========================
  async getHistory(taskerId: string) {
    return this.orderModel
      .find({
        taskerId,
        status: OrderStatus.COMPLETED,
      })
      .sort({ createdAt: -1 });
  }

  // ==========================
  // STATS
  // ==========================
  async getStats(taskerId: string) {
    const totalCompleted = await this.orderModel.countDocuments({
      taskerId,
      status: OrderStatus.COMPLETED,
    });

    const active = await this.getActiveOrder(taskerId);

    return {
      totalCompleted,
      hasActiveOrder: !!active,
    };
  }
}