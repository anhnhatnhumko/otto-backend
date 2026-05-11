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
import { Service } from '../services/service.schema';
import { MailService } from '../mail/mail.service';
import { OrderStatus } from '../orders/order-status.enum';

const REWARD_TIERS = [
  {
    level: 'Thành viên',
    minPoints: 0,
    nextLevelName: 'Bronze',
    nextLevelPoints: 5000,
  },
  {
    level: 'Bronze',
    minPoints: 5000,
    nextLevelName: 'VIP Silver',
    nextLevelPoints: 10000,
  },
  {
    level: 'VIP Silver',
    minPoints: 10000,
    nextLevelName: 'VIP Gold',
    nextLevelPoints: 20000,
  },
  {
    level: 'VIP Gold',
    minPoints: 20000,
    nextLevelName: 'VIP Platinum',
    nextLevelPoints: 50000,
  },
  {
    level: 'VIP Platinum',
    minPoints: 50000,
    nextLevelName: 'VIP Platinum',
    nextLevelPoints: 50000,
  },
] as const;

function getRewardTier(points: number) {
  const currentTier = [...REWARD_TIERS]
    .reverse()
    .find((tier) => points >= tier.minPoints) ?? REWARD_TIERS[0];

  const pointsToNextLevel = Math.max(0, currentTier.nextLevelPoints - points);
  const rewardProgress =
    currentTier.nextLevelPoints > 0
      ? Math.min(100, Math.round((points / currentTier.nextLevelPoints) * 100))
      : 100;

  return {
    memberLevel: currentTier.level,
    nextLevelName: currentTier.nextLevelName,
    nextLevelPoints: currentTier.nextLevelPoints,
    pointsToNextLevel,
    rewardProgress,
    isMaxLevel: currentTier.level === 'VIP Platinum',
  };
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  /**
   * Update customer profile (fullName, email, phone)
   * Handles email verification flow if email changes
   */
  async updateProfile(customerId: string, dto: any) {
    try {
      const user = await this.userModel.findById(customerId);

      if (!user) {
        throw new NotFoundException('Khách hàng không tìm thấy');
      }

      const fullName = (dto.fullName || '').trim();
      const email = (dto.email || '').trim().toLowerCase();
      const phone = (dto.phone || '').trim();

      if (!fullName || !email || !phone) {
        throw new BadRequestException(
          'Họ tên, email và số điện thoại không được để trống',
        );
      }

      const nextEmail = email;
      const currentEmail = (user.email || '').trim().toLowerCase();
      const isEmailChanged = nextEmail && nextEmail !== currentEmail;

      if (isEmailChanged) {
        const existedEmail = await this.userModel.findOne({
          email: nextEmail,
          _id: { $ne: customerId },
        });

        if (existedEmail) {
          throw new BadRequestException('Email đã được sử dụng bởi tài khoản khác');
        }

        const verifyToken = this.jwtService.sign(
          { email: nextEmail },
          { expiresIn: '15m' },
        );

        user.email = nextEmail;
        user.isEmailVerified = false;
        user.emailVerifyToken = verifyToken;
        user.emailVerifyExpires = new Date(Date.now() + 15 * 60 * 1000);
      }

      user.fullName = fullName;
      user.phone = phone;

      await user.save();

      if (isEmailChanged) {
        await this.mailService.sendVerifyEmail(user.email, user.emailVerifyToken as string);
      }

      const updatedUser = await this.userModel.findById(customerId);

      return updatedUser;
    } catch (error: any) {
      console.error('❌ Lỗi cập nhật profile customer:', error);
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new BadRequestException(
          `${field} đã được sử dụng bởi tài khoản khác`,
        );
      }
      throw error;
    }
  }

  /**
   * Get customer profile stats: total orders, total spent, avg rating, loyalty points, member level
   */
  async getProfileStats(customerId: string) {
    const userId = new Types.ObjectId(customerId);

    // Total orders
    const totalOrders = await this.orderModel.countDocuments({
      customerId: userId,
    });

    // Total spent (sum of all completed orders)
    const spentResult = await this.orderModel.aggregate([
      {
        $match: {
          customerId: userId,
          status: OrderStatus.COMPLETED,
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$totalPrice' },
        },
      },
    ]);

    const totalSpent = spentResult[0]?.totalSpent ?? 0;

    // Average rating given by customer (avg rating of taskers they rated)
    const ratingResult = await this.orderModel.aggregate([
      {
        $match: {
          customerId: userId,
          rating: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
        },
      },
    ]);

    const avgRating = ratingResult[0]?.avgRating ? Math.round(ratingResult[0].avgRating * 10) / 10 : 0;

    // Loyalty points (1 point per 1000 VND spent)
    const loyaltyPoints = Math.floor(totalSpent / 1000);

    const rewardTier = getRewardTier(loyaltyPoints);

    return {
      totalOrders,
      totalSpent,
      avgRating,
      loyaltyPoints,
      memberLevel: rewardTier.memberLevel,
      nextLevelName: rewardTier.nextLevelName,
      nextLevelPoints: rewardTier.nextLevelPoints,
      pointsToNextLevel: rewardTier.pointsToNextLevel,
      rewardProgress: rewardTier.rewardProgress,
      isMaxLevel: rewardTier.isMaxLevel,
    };
  }

  /**
   * Get customer's favorite/frequently booked services
   */
  async getFavoriteServices(customerId: string, limit = 5) {
    const userId = new Types.ObjectId(customerId);

    const favorites = await this.orderModel.aggregate([
      {
        $match: {
          customerId: userId,
        },
      },
      {
        $group: {
          _id: '$serviceId',
          bookingCount: { $sum: 1 },
        },
      },
      {
        $sort: { bookingCount: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'serviceDetails',
        },
      },
      {
        $unwind: {
          path: '$serviceDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          serviceId: '$_id',
          serviceName: '$serviceDetails.name',
          bookingCount: 1,
          icon: '$serviceDetails.icon',
        },
      },
    ]);

    return favorites;
  }

  /**
   * Get customer profile details
   */
  async getCustomerProfile(customerId: string | Types.ObjectId) {
    let userId: Types.ObjectId;
    
    if (typeof customerId === 'string') {
      userId = new Types.ObjectId(customerId);
    } else {
      userId = customerId;
    }

    const user = await this.userModel.findById(userId).lean();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      address: user.address,
    };
  }
}
