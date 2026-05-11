import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from './order.schema';
import { Service } from '../services/service.schema';
import { OrderStatus } from './order-status.enum';
import { User } from '../users/user.schema';
import { ChatMessage } from '../chat/message.schema';
import { AdminGateway } from 'src/admin/admin.gateway';
import { PaymentOrchestratorService } from 'src/payments/payment-orchestrator.service';
import { MailService } from 'src/mail/mail.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { presentOrder } from './order-presentation.util';

function combineDateTime(date: Date, time: string) {
  const [hour, minute] = time.split(':').map(Number);

  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);

  return result;
}

function normalizeAddress(address?: string, addressDetail?: string) {
  return String(address ?? addressDetail ?? '').trim();
}

function buildFullAddress(provinceName?: string, wardName?: string) {
  return [provinceName, wardName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessage>,
    private adminGateway: AdminGateway,
    private paymentOrchestrator: PaymentOrchestratorService,
    private mailService: MailService,
    private notificationsService: NotificationsService,
  ) { }

  private async emitUserUpdateWithStats(userId: Types.ObjectId | string) {
    const user = (await this.userModel
      .findById(userId)
      .populate('provinceId', 'name')
      .populate('wardId', 'name')
      .lean()) as any;
    if (!user) return;

    // Tính order count
    const orderCount = await this.orderModel.countDocuments({
      customerId: user._id,
    });

    // Tính totalSpent cho CUSTOMER
    let totalSpent = 0;
    if (user.role === 'CUSTOMER') {
      const result = await this.orderModel.aggregate([
        { $match: { customerId: user._id, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } }
      ]);
      totalSpent = result[0]?.total ?? 0;
    }

    // Tính earnings cho TASKER từ completed orders
    let earnings = 0;
    if (user.role === 'TASKER') {
      const result = await this.orderModel.aggregate([
        { $match: { taskerId: user._id, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } }
      ]);
      earnings = result[0]?.total ?? 0;
    }

    // Build address từ province + ward
    const provinceName = user.provinceId?.name || "";
    const wardName = user.wardId?.name || "";
    const address = buildFullAddress(provinceName, wardName);

    const enrichedUser = {
      ...user,
      orders: orderCount,
      totalSpent,
      earnings,
      address,
    };

    this.adminGateway.emitUserUpdated(enrichedUser);
  }

  private async emitOrderUpdateById(orderId: Types.ObjectId | string) {
    const populated = await this.orderModel
      .findById(orderId)
      .populate('customerId', 'fullName phone email')
      .populate('taskerId', 'fullName phone email')
      .lean();

    if (populated) {
      this.adminGateway.emitOrderUpdated(presentOrder(populated));
    }
  }

  async checkCustomerOverlap(customerId: string, start: Date, end: Date) {
    return this.orderModel.findOne({
      customerId: new Types.ObjectId(customerId),
      status: {
        $in: [
          OrderStatus.SEARCHING,
          OrderStatus.ASSIGNED,
          OrderStatus.IN_PROGRESS,
        ],
      },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });
  }

  async create(customerId: string, dto: any) {
    const service = await this.serviceModel.findById(dto.serviceId);

    const newStart = combineDateTime(dto.scheduleTime, dto.startTime);
    const newEnd = combineDateTime(dto.scheduleTime, dto.endTime);

    const totalHours =
      (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60);

    if (!service || !service.isActive) {
      throw new NotFoundException('Service not found');
    }

    if (dto.scheduleTime < new Date()) {
      throw new BadRequestException('Schedule time must be in the future');
    }

    if (newStart >= newEnd) {
      throw new BadRequestException('Invalid time range');
    }

    const overlap = await this.orderModel.findOne({
      customerId: new Types.ObjectId(customerId),
      status: {
        $in: [
          OrderStatus.SEARCHING,
          OrderStatus.ASSIGNED,
          OrderStatus.IN_PROGRESS,
        ],
      },
      startTime: { $lt: newEnd },
      endTime: { $gt: newStart },
    });

    if (overlap) {
      throw new BadRequestException('Bạn đã có lịch trùng thời gian này');
    }

    if (totalHours < service.minHours) {
      throw new BadRequestException(
        `Minimum booking is ${service.minHours} hours`,
      );
    }

    if (totalHours > service.maxHours) {
      throw new BadRequestException(
        `Maximum booking is ${service.maxHours} hours`,
      );
    }

    // 🔥 XÁC ĐỊNH PAYMENT METHOD
    const isCash = dto.paymentMethod === 'cash';

    let availableTaskers: any[] = [];

    // 🔥 CHỈ MATCH TASKER NẾU CASH
    if (isCash) {
      const busyTaskers = await this.orderModel.find({
        status: {
          $in: [
            OrderStatus.ASSIGNED,
            OrderStatus.IN_PROGRESS,
          ],
        },
        startTime: { $lt: newEnd },
        endTime: { $gt: newStart },
      }).distinct('taskerId');

      // Match skills stored as ObjectId or as string (some records use string ids)
      const serviceIdObj = new Types.ObjectId(dto.serviceId);
      const serviceIdStr = String(dto.serviceId);
      availableTaskers = await this.userModel.find({
        role: 'TASKER',
        wardId: new Types.ObjectId(dto.wardId),
        skills: {
          $in: [serviceIdObj, serviceIdStr],
        },
        _id: { $nin: busyTaskers.filter(Boolean) },
      })
        .sort({ rating: -1 })
        .limit(5);

      if (!availableTaskers.length) {
        throw new BadRequestException('Không có tasker phù hợp');
      }
    }

    // 🔥 TẠO ORDER
    const order = await this.orderModel.create({
      customerId: new Types.ObjectId(customerId),
      serviceId: new Types.ObjectId(dto.serviceId),
      provinceId: dto.provinceId,
      wardId: dto.wardId,
      serviceSnapshot: {
        name: service.name,
        pricePerHour: service.pricePerHour,
      },
      address: normalizeAddress(dto.address, dto.addressDetail),
      addressDetail: dto.addressDetail ?? normalizeAddress(dto.address, dto.addressDetail),
      scheduleTime: dto.scheduleTime,
      startTime: newStart,
      endTime: newEnd,
      totalHours,
      totalPrice: totalHours * service.pricePerHour,
      note: dto.note,
      paymentMethod: dto.paymentMethod, // 🔥 THÊM DÒNG NÀY

      // 🔥 QUAN TRỌNG NHẤT
      status: isCash
        ? OrderStatus.SEARCHING
        : OrderStatus.PENDING_PAYMENT,

      // 🔥 CHỈ ASSIGN NẾU CASH
      offeredTaskers: isCash
        ? availableTaskers.map(t => t._id)
        : [],

      offerExpiresAt: isCash
        ? new Date(Date.now() + 60 * 1000)
        : undefined,
    });
    const populated = await this.orderModel
      .findById(order._id)
      .populate('customerId', 'fullName phone email')
      .populate('taskerId', 'fullName phone email')
      .lean();

    this.adminGateway.emitNewOrder(populated ? presentOrder(populated) : populated);

    // Emit user updated with order count and totalSpent
    await this.emitUserUpdateWithStats(customerId);

    return populated ? presentOrder(populated) : populated;
  }

  async dispatchTasker(order: any) {
    console.log("🔥 ===== DISPATCH START =====");
    // 🔥 1. VALIDATE STATE
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Order not ready for dispatch');
    }

    // 🔥 tránh dispatch 2 lần
    if (order.offeredTaskers && order.offeredTaskers.length > 0) {
      return order;
    }

    const start = order.startTime;
    const end = order.endTime;

    // 🔥 2. TÌM TASKER BẬN
    const busyTaskers = await this.orderModel.find({
      status: {
        $in: [
          OrderStatus.ASSIGNED,
          OrderStatus.IN_PROGRESS,
        ],
      },
      startTime: { $lt: end },
      endTime: { $gt: start },
    }).distinct('taskerId');

    // 🔥 3. TÌM TASKER AVAILABLE
    // Exclude busy taskers and any taskers who previously rejected this order
    const excludeIds = busyTaskers.filter(Boolean).concat(order.rejectedTaskers || []);

    const serviceIdObj = new Types.ObjectId(order.serviceId);
    const serviceIdStr = String(order.serviceId);
    const availableTaskers = await this.userModel.find({
      role: 'TASKER',
      wardId: new Types.ObjectId(order.wardId),
      skills: {
        $in: [serviceIdObj, serviceIdStr],
      },
      _id: { $nin: excludeIds },
    })
      .sort({ rating: -1 })
      .limit(20);

    console.log("👉 availableTaskers:", availableTaskers);
    console.log("👉 count:", availableTaskers.length);

    if (!availableTaskers.length) {

      throw new BadRequestException('Không có tasker phù hợp');
    }

    // 🔥 4. UPDATE ATOMIC (QUAN TRỌNG)
    const updated = await this.orderModel.findOneAndUpdate(
      {
        _id: order._id,
        status: OrderStatus.PAID,
      },
      {
        $set: {
          status: OrderStatus.SEARCHING,
          offeredTaskers: availableTaskers.map(t => t._id),
          offerExpiresAt: new Date(Date.now() + 60 * 1000), // 1 phút để tasker nhận việc
        },
      },
      { new: true },
    );

    if (!updated) {
      throw new BadRequestException('Dispatch failed or already processed');
    }

    await this.emitOrderUpdateById(updated._id as Types.ObjectId);

    return updated;
  }

  // ==========================
  // TASKER - REJECT OFFER
  // ==========================
  async rejectOrder(orderId: string, taskerId: string) {
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Only allow rejecting while order is still searching
    if (order.status !== OrderStatus.SEARCHING) {
      throw new BadRequestException('Order not available');
    }

    // Atomically add to rejectedTaskers and remove from offeredTaskers
    const updated = await this.orderModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(orderId),
        status: OrderStatus.SEARCHING,
      },
      {
        $addToSet: { rejectedTaskers: new Types.ObjectId(taskerId) },
        $pull: { offeredTaskers: new Types.ObjectId(taskerId) },
      },
      { new: true },
    );

    if (!updated) {
      throw new BadRequestException('Reject failed or order not in correct state');
    }

    await this.emitOrderUpdateById(updated._id as Types.ObjectId);

    return updated;
  }

  // ==========================
  // CUSTOMER - MY ORDERS
  // ==========================
  async findMyOrders(customerId: string) {
    const orders = await this.orderModel
      .find({ customerId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'taskerId',
        select: 'fullName avatar rating totalJobs phone',
      })
      .lean();

    return orders.map((order) => {
      const t = order.taskerId as any;

      return {
        ...presentOrder(order),
        tasker: t
          ? {
            name: t.fullName,
            avatar: t.avatar, // 🔥 CHÍNH DÒNG BỊ THIẾU
            rating: t.rating,
            completedJobs: t.totalJobs,
            phone: t.phone,
          }
          : null,
      };
    }
    );
  }

  /**
   * Find orders by status with filters (for profile dashboard)
   */
  async findMyOrdersByStatus(
    customerId: string,
    status?: string,
    sort: string = '-createdAt',
    limit: number = 20,
  ) {
    const query: any = { customerId: new Types.ObjectId(customerId) };

    if (status) {
      const statuses = status.split(',').map((s) => s.trim());
      query.status = { $in: statuses };
    }

    const orders = await this.orderModel
      .find(query)
      .sort(sort)
      .limit(limit)
      .populate({
        path: 'taskerId',
        select: 'fullName avatar rating totalJobs phone',
      })
      .lean();

    return orders.map((order) => {
      const t = order.taskerId as any;

      return {
        ...presentOrder(order),
        tasker: t
          ? {
            name: t.fullName,
            avatar: t.avatar,
            rating: t.rating,
            completedJobs: t.totalJobs,
            phone: t.phone,
          }
          : null,
      };
    });
  }

  // ==========================
  // VIEW ORDER DETAIL
  // ==========================
  async findById(orderId: string, user: any) {
    const order = await this.orderModel
      .findById(orderId)
      .populate({
        path: 'taskerId',
        select: 'fullName avatar rating totalJobs phone',
      })
      .lean();
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const mappedOrder = {
      ...presentOrder(order),
      tasker: order.taskerId
        ? (() => {
          const t = order.taskerId as any;
          return {
            name: t.fullName,
            avatar: t.avatar,
            rating: t.rating,
            completedJobs: t.totalJobs,
            phone: t.phone,
          };
        })()
        : null,
    };

    if (user.role === 'ADMIN') return mappedOrder;

    if (
      user.role === 'CUSTOMER' &&
      order.customerId.toString() === user.userId
    ) {
      return mappedOrder;
    }

    if (
      user.role === 'TASKER' &&
      order.taskerId &&
      order.taskerId.toString() === user.userId
    ) {
      return mappedOrder;
    }

    throw new ForbiddenException('Access denied');
  }

  // ==========================
  // TASKER ACCEPT ORDER
  // ==========================
  async acceptOrder(orderId: string, taskerId: string) {
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // 🔥 CHECK TRÙNG LỊCH TASKER
    const conflict = await this.orderModel.findOne({
      taskerId: new Types.ObjectId(taskerId),
      status: {
        $in: [
          OrderStatus.ASSIGNED,
          OrderStatus.IN_PROGRESS,
        ],
      },
      startTime: { $lt: order.endTime },
      endTime: { $gt: order.startTime },
    });

    if (conflict) {
      throw new BadRequestException(
        'Bạn đã có công việc trùng thời gian',
      );
    }

    // 🔥 ATOMIC ACCEPT
    const updated = await this.orderModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(orderId),
        status: OrderStatus.SEARCHING,
        taskerId: null,
      },
      {
        $set: {
          status: OrderStatus.ASSIGNED,
          taskerId: new Types.ObjectId(taskerId),
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new BadRequestException("Order already taken");
    }

    await this.emitOrderUpdateById(updated._id as Types.ObjectId);

    // 🔥 GET TASKER AND CUSTOMER INFO
    const tasker = await this.userModel.findById(taskerId).lean();
    const customer = await this.userModel.findById(order.customerId).lean();

    if (customer && customer.email) {
      // 🔥 SEND EMAIL TO CUSTOMER
      try {
        await this.mailService.sendOrderAcceptedEmail(
          customer.email,
          customer.fullName,
          tasker?.fullName || 'Tasker',
          orderId,
          order.serviceSnapshot?.name || 'Dịch vụ'
        );
      } catch (err) {
        console.error('Failed to send email:', err);
      }
    }

    if (customer) {
      // 🔥 SEND NOTIFICATION TO CUSTOMER
      await this.notificationsService.createNotification(
        customer._id.toString(),
        {
          title: 'Đơn hàng được nhận',
          content: `${tasker?.fullName || 'Tasker'} đã nhận đơn hàng của bạn`,
          type: 'order_accepted',
          orderId: orderId,
          senderId: taskerId,
          senderName: tasker?.fullName,
        }
      );
    }

    return updated;
  }

  // ==========================
  // TASKER START ORDER
  // ==========================
  async startOrder(orderId: string, taskerId: string) {
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status !== OrderStatus.ASSIGNED ||
      order.taskerId?.toString() !== taskerId
    ) {
      throw new ForbiddenException('Invalid order state');
    }

    const now = new Date();
    const oneHourBefore = new Date(order.scheduleTime.getTime() - 60 * 60 * 1000);

    if (now < oneHourBefore) {
      throw new BadRequestException('Order can only be started within 1 hour before schedule time');
    }

    if (order.endTime && new Date() > new Date(order.endTime)) {
      throw new BadRequestException('Order is overdue and cannot be started');
    }

    order.status = OrderStatus.IN_PROGRESS;

    const saved = await order.save();

    await this.emitOrderUpdateById(saved._id as Types.ObjectId);

    return saved;
  }

  // ==========================
  // TASKER COMPLETE ORDER
  // ==========================
  async completeOrder(orderId: string, taskerId: string) {
    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        status: OrderStatus.IN_PROGRESS,
        taskerId: new Types.ObjectId(taskerId),
      },
      {
        status: OrderStatus.WAITING_CONFIRMATION,
        completedAt: new Date(),
      },
      { new: true },
    );

    if (!order) {
      throw new ForbiddenException('Invalid order state');
    }

    await this.emitOrderUpdateById(order._id as Types.ObjectId);

    return order;
  }

  async confirmCompleted(orderId: string, customerId: string) {

    console.log("🔥 BE RECEIVED orderId:", orderId);
    console.log("🔥 TYPE:", typeof orderId);
    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        status: OrderStatus.WAITING_CONFIRMATION,
        customerId: new Types.ObjectId(customerId), // 🔥 FIX
      },
      {
        status: OrderStatus.COMPLETED,
        confirmedAt: new Date(), // 🔥 FIX
      },
      { new: true },
    );

    if (!order) {
      throw new ForbiddenException('Invalid order state');
    }

    if (order.taskerId) {
      await this.userModel.findByIdAndUpdate(order.taskerId, {
        $inc: { totalJobs: 1 },
      });
    }
    if (!order.taskerId) {
      throw new BadRequestException('No tasker assigned');
    }

    await this.emitOrderUpdateById(order._id as Types.ObjectId);

    // 🔥 GET TASKER AND CUSTOMER INFO
    const tasker = await this.userModel.findById(order.taskerId).lean();
    const customer = await this.userModel.findById(order.customerId).lean();

    if (customer && customer.email) {
      // 🔥 GENERATE BILL HTML
      const billHtml = `
        <table style="width: 100%; border-collapse: collapse; background-color: #fff; border: 1px solid #e5e7eb; border-radius: 5px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 12px; text-align: left; font-weight: bold; border-right: 1px solid #e5e7eb;">Dịch vụ</th>
              <th style="padding: 12px; text-align: center; font-weight: bold; border-right: 1px solid #e5e7eb;">Giá/giờ</th>
              <th style="padding: 12px; text-align: center; font-weight: bold; border-right: 1px solid #e5e7eb;">Số giờ</th>
              <th style="padding: 12px; text-align: right; font-weight: bold;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px; border-right: 1px solid #e5e7eb;">${order.serviceSnapshot?.name || 'Dịch vụ'}</td>
              <td style="padding: 12px; text-align: center; border-right: 1px solid #e5e7eb;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.serviceSnapshot?.pricePerHour || 0)}</td>
              <td style="padding: 12px; text-align: center; border-right: 1px solid #e5e7eb;">${order.totalHours || 0} giờ</td>
              <td style="padding: 12px; text-align: right; font-weight: bold; color: #10b981;">${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.totalPrice || 0)}</td>
            </tr>
          </tbody>
        </table>
      `;

      // 🔥 SEND EMAIL TO CUSTOMER
      try {
        await this.mailService.sendOrderCompletedEmail(
          customer.email,
          customer.fullName,
          tasker?.fullName || 'Tasker',
          orderId,
          order.serviceSnapshot?.name || 'Dịch vụ',
          order.totalPrice || 0,
          billHtml
        );
      } catch (err) {
        console.error('Failed to send email:', err);
      }
    }

    if (customer) {
      // 🔥 SEND NOTIFICATION TO CUSTOMER
      await this.notificationsService.createNotification(
        customer._id.toString(),
        {
          title: 'Đơn hàng hoàn thành',
          content: `Đơn hàng của bạn đã hoàn thành. Vui lòng kiểm tra email để xem hóa đơn.`,
          type: 'order_completed',
          orderId: orderId,
          senderId: order.taskerId?.toString(),
          senderName: tasker?.fullName,
        }
      );
    }

    return order;
  }

  async rateCompletedOrder(
    orderId: string,
    customerId: string,
    body: { rating: number; review?: string },
  ) {
    const rating = Number(body.rating);

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const review = typeof body.review === 'string' ? body.review.trim() : '';

    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        customerId: new Types.ObjectId(customerId),
        status: OrderStatus.COMPLETED,
      },
      {
        rating,
        review: review || undefined,
      },
      { new: true },
    );

    if (!order) {
      throw new ForbiddenException('Invalid order state');
    }

    // Update tasker's average rating
    if (order.taskerId) {
      const allCompletedOrders = await this.orderModel
        .find({
          taskerId: order.taskerId,
          status: OrderStatus.COMPLETED,
          rating: { $exists: true, $ne: null },
        })
        .lean();

      const totalRating = allCompletedOrders.reduce((sum, o: any) => sum + (o.rating || 0), 0);
      const averageRating = allCompletedOrders.length > 0 ? totalRating / allCompletedOrders.length : 0;

      await this.userModel.findByIdAndUpdate(
        order.taskerId,
        {
          rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
        },
        { new: true },
      );
    }

    await this.emitOrderUpdateById(order._id as Types.ObjectId);

    return order;
  }

  async markAsPaid(orderId: string, userId: string) {
    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        customerId: new Types.ObjectId(userId), // 🔥 chống hack
        status: OrderStatus.PENDING_PAYMENT,
      },
      {
        status: OrderStatus.PAID,
        paidAt: new Date(),
      },
      { new: true },
    );

    if (!order) {
      throw new BadRequestException('Invalid order');
    }

    await this.emitOrderUpdateById(order._id as Types.ObjectId);

    return order;
  }

  // ==========================
  // CUSTOMER CANCEL ORDER
  // ==========================
  async cancelOrder(orderId: string, customerId: string) {
    const order = await this.orderModel.findById(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId.toString() !== customerId) {
      throw new ForbiddenException('Not your order');
    }

    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.IN_PROGRESS
    ) {
      throw new BadRequestException('Cannot cancel at this stage');
    }

    order.status = OrderStatus.CANCELLED;
    await order.save();

    await this.emitOrderUpdateById(order._id as Types.ObjectId);

    return order;
  }

  async findMyTaskerOrders(taskerId: string) {

    console.log("QUERY TASKER:", taskerId);

    const jobs = await this.orderModel.find({
      taskerId: new Types.ObjectId(taskerId),
    })
      .populate('customerId', "fullName phone note");

    // Add unreadMessages count to each order (only unread from customer)
    const jobsWithUnread = await Promise.all(
      jobs.map(async (job: any) => {
        const unreadCount = await this.chatMessageModel.countDocuments({
          orderId: job._id.toString(),
          senderRole: 'CUSTOMER',
          read: false,
        });
        return {
          ...job.toObject(),
          unreadMessages: unreadCount,
        };
      })
    );

    return jobsWithUnread;
  }

  // ==========================
  // TASKER - AVAILABLE JOBS
  // ==========================
  async findAvailableOrders(taskerId: string) {
    const orders = await this.orderModel.find({
      status: OrderStatus.SEARCHING,
      offeredTaskers: new Types.ObjectId(taskerId),
    })
      .populate('customerId', "fullName phone");

    // Add unreadMessages count to each order (only unread from customer)
    const ordersWithUnread = await Promise.all(
      orders.map(async (order: any) => {
        const unreadCount = await this.chatMessageModel.countDocuments({
          orderId: order._id.toString(),
          senderRole: 'CUSTOMER',
          read: false,
        });
        return {
          ...order.toObject(),
          unreadMessages: unreadCount,
        };
      })
    );

    return ordersWithUnread;
  }

  // ==========================
  // AUTO TIMEOUT - Hủy đơn quá hạn
  // ==========================
  async handleTimeoutOrders() {
    const now = new Date();
    const timeoutCutoff = new Date(now.getTime() - 2 * 60 * 1000);

    // Tìm những đơn hàng ASSIGNED đã qua endTime + 2 phút
    const timeoutOrders = await this.orderModel.find({
      status: OrderStatus.ASSIGNED,
      endTime: { $lte: timeoutCutoff },
    });

    for (const order of timeoutOrders) {
      // Cập nhật status thành TIMEOUT
      order.status = OrderStatus.TIMEOUT;
      await order.save();

      // Gọi payment orchestrator để xử lý refund nếu cần
      try {
        await this.paymentOrchestrator.handleTimeout(order);
      } catch (err) {
        console.error('Error handling refund for timeout order', order._id, err);
      }
      // Hoàn tiền cho customer (thêm vào order history hoặc wallet transaction)
      // Sẽ xử lý qua wallet service nếu cần

      // Emit update
      await this.emitOrderUpdateById(order._id as Types.ObjectId);
      await this.emitUserUpdateWithStats(order.customerId);
    }

    console.log(`Auto-timeout processed: ${timeoutOrders.length} orders`);
    return timeoutOrders.length;
  }
}
