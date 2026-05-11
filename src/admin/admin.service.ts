import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../users/user.schema';
import { Order } from '../orders/order.schema';
import { Service } from '../services/service.schema';
import { Transaction } from 'src/wallet/schemas/transaction.schema';
import { AdminGateway } from './admin.gateway';
import { OrderStatus } from 'src/orders/order-status.enum';
import { presentOrder } from 'src/orders/order-presentation.util';
import { MailService } from 'src/mail/mail.service';

type PopulatedUserName = {
    _id: Types.ObjectId;
    fullName?: string;
    phone?: string;
    email?: string;
};

type AdminOrderItem = Omit<Order, 'customerId' | 'taskerId'> & {
    _id: Types.ObjectId;
    customerId?: PopulatedUserName | null;
    taskerId?: PopulatedUserName | null;
    createdAt?: Date;
    address?: string;
};

type AdminTransactionItem = Omit<Transaction, 'userId'> & {
    _id: Types.ObjectId;
    userId?: PopulatedUserName | null;
};

type CreateTaskerFieldErrors = Partial<
    Record<'name' | 'email' | 'phone' | 'provinceId' | 'wardId' | 'services', string>
>;

function buildFullAddress(provinceName?: string, wardName?: string) {
    return [provinceName, wardName]
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(', ');
}

@Injectable()
export class AdminService {
    constructor(
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Order.name) private orderModel: Model<Order>,
        @InjectModel(Service.name) private serviceModel: Model<Service>,
        @InjectModel(Transaction.name) private txModel: Model<Transaction>,
        private adminGateway: AdminGateway,
        private mailService: MailService,
    ) { }

    private throwCreateTaskerValidation(
        message: string,
        fieldErrors: CreateTaskerFieldErrors,
    ): never {
        throw new BadRequestException({
            message,
            fieldErrors,
        });
    }

    // ================= DASHBOARD =================
    async getDashboard() {
        const [users, orders, txs] = await Promise.all([
            this.userModel.countDocuments(),
            this.orderModel.countDocuments(),
            this.txModel.countDocuments(),
        ]);

        const revenueAgg = await this.orderModel.aggregate([
            { $match: { status: 'COMPLETED' } },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } },
        ]);

        return {
            totalUsers: users,
            totalOrders: orders,
            totalTransactions: txs,
            totalRevenue: revenueAgg[0]?.total || 0,
        };
    }

    // ================= CREATE TASKER =================
    async createTasker(dto: any) {
        if (dto !== undefined) {
            return this.createTaskerWithValidation(dto);
        }

        const { name, email, phone, provinceId, wardId, services } = dto;

        // Validate required fields
        if (!name || !email || !phone || !provinceId || !wardId) {
            throw new BadRequestException('Vui lòng điền đầy đủ thông tin bắt buộc');
        }

        // Check if email or phone already exists
        const exists = await this.userModel.findOne({
            $or: [{ email }, { phone }],
        });

        if (exists) {
            throw new BadRequestException('Email hoặc số điện thoại đã được sử dụng');
        }

        // Generate a temporary password
        const tempPassword = Math.random().toString(36).substring(2, 10);
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Create user with TASKER role and mark as pending
        const user = await this.userModel.create({
            email,
            phone,
            password: hashedPassword,
            fullName: name,
            role: 'TASKER',
            provinceId: new Types.ObjectId(provinceId),
            wardId: new Types.ObjectId(wardId),
            status: 'ACTIVE',
            isEmailVerified: true, // Admin-created tasker is auto-verified
            mustChangePassword: true,
            skills: services || [], // Store service names or IDs
        });

        return {
            message: 'Tasker được thêm thành công',
            tasker: {
                id: user._id,
                name: user.fullName,
                email: user.email,
                phone: user.phone,
                tempPassword, // Send this to the user via email/SMS
            },
        };
    }

    private async createTaskerWithValidation(dto: any) {
        const name = String(dto?.name ?? '').trim();
        const email = String(dto?.email ?? '').trim();
        const phone = String(dto?.phone ?? '').trim();
        const provinceId = String(dto?.provinceId ?? '').trim();
        const wardId = String(dto?.wardId ?? '').trim();
        const rawServices: unknown[] = Array.isArray(dto?.services) ? dto.services : [];
        const serviceIds: string[] = [
            ...new Set(
                rawServices
                    .map((serviceId) => String(serviceId).trim())
                    .filter(Boolean),
            ),
        ];

        const requiredFieldErrors: CreateTaskerFieldErrors = {};

        if (!name) requiredFieldErrors.name = 'Vui lòng nhập họ tên';
        if (!email) requiredFieldErrors.email = 'Vui lòng nhập email';
        if (!phone) requiredFieldErrors.phone = 'Vui lòng nhập số điện thoại';
        if (!provinceId) requiredFieldErrors.provinceId = 'Vui lòng chọn tỉnh';
        if (!wardId) requiredFieldErrors.wardId = 'Vui lòng chọn quận/huyện';
        if (serviceIds.length === 0) {
            requiredFieldErrors.services = 'Vui lòng chọn ít nhất 1 dịch vụ';
        }

        if (Object.keys(requiredFieldErrors).length > 0) {
            this.throwCreateTaskerValidation(
                'Vui lòng điền đầy đủ thông tin bắt buộc',
                requiredFieldErrors,
            );
        }

        const invalidObjectIdErrors: CreateTaskerFieldErrors = {};

        if (!Types.ObjectId.isValid(provinceId)) {
            invalidObjectIdErrors.provinceId = 'Tỉnh không hợp lệ';
        }

        if (!Types.ObjectId.isValid(wardId)) {
            invalidObjectIdErrors.wardId = 'Quận/huyện không hợp lệ';
        }

        if (serviceIds.some((serviceId) => !Types.ObjectId.isValid(serviceId))) {
            invalidObjectIdErrors.services = 'Dịch vụ không hợp lệ';
        }

        if (Object.keys(invalidObjectIdErrors).length > 0) {
            this.throwCreateTaskerValidation(
                'Thông tin tasker không hợp lệ',
                invalidObjectIdErrors,
            );
        }

        const duplicateUsers = await this.userModel
            .find({
                $or: [{ email }, { phone }],
            })
            .select('email phone')
            .lean<Array<{ email?: string; phone?: string }>>();

        const duplicateFieldErrors: CreateTaskerFieldErrors = {};

        if (duplicateUsers.some((user) => user.email === email)) {
            duplicateFieldErrors.email = 'Email đã tồn tại.';
        }

        if (duplicateUsers.some((user) => user.phone === phone)) {
            duplicateFieldErrors.phone = 'Số điện thoại đã tồn tại.';
        }

        if (Object.keys(duplicateFieldErrors).length > 0) {
            let duplicateMessage = 'Thông tin liên hệ đã tồn tại trong hệ thống.';

            if (duplicateFieldErrors.email && duplicateFieldErrors.phone) {
                duplicateMessage = 'Email và số điện thoại đã tồn tại trong hệ thống.';
            } else if (duplicateFieldErrors.email) {
                duplicateMessage = 'Email đã tồn tại .';
            } else if (duplicateFieldErrors.phone) {
                duplicateMessage = 'Số điện thoại đã tồn tại.';
            }

            this.throwCreateTaskerValidation(duplicateMessage, duplicateFieldErrors);
        }

        const serviceObjectIds = serviceIds.map(
            (serviceId) => new Types.ObjectId(serviceId),
        );

        const matchedServices = await this.serviceModel
            .find({
                _id: { $in: serviceObjectIds },
                isActive: true,
            })
            .select('_id')
            .lean<Array<{ _id: Types.ObjectId }>>();

        if (matchedServices.length !== serviceObjectIds.length) {
            this.throwCreateTaskerValidation(
                'Dịch vụ đăng ký không hợp lệ.',
                {
                    services:
                        'Một hoặc nhiều dịch vụ không tồn tại hoặc đã bị vô hiệu hóa.',
                },
            );
        }

        const tempPassword = Math.random().toString(36).substring(2, 10);
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const avatarUrl = String(dto?.avatarUrl ?? dto?.avatar ?? '').trim() || undefined;

        const userPayload: any = {
            email,
            phone,
            password: hashedPassword,
            fullName: name,
            role: 'TASKER',
            provinceId: new Types.ObjectId(provinceId),
            wardId: new Types.ObjectId(wardId),
            status: 'ACTIVE',
            isEmailVerified: true,
            mustChangePassword: true,
            skills: serviceObjectIds,
            rating: 5,
        };

        if (avatarUrl) {
            userPayload.avatar = avatarUrl;
        }

        const user = await this.userModel.create(userPayload);

        this.adminGateway.emitTaskerUpdated(user);

        // 🔥 Gửi email thông báo tài khoản mới cho tasker
        try {
            console.log('🔥 [Admin Service] Đang gửi email tasker mới:', email);
            await this.mailService.sendTaskerAccountCreatedEmail(
                email,
                user.fullName,
                tempPassword,
            );
            console.log('✅ [Admin Service] Email tasker mới đã gửi thành công');
        } catch (err) {
            console.error('❌ Lỗi gửi email cho tasker mới:', err);
            // Không throw error, vì tài khoản đã được tạo thành công
        }

        return {
            message: 'Tasker được thêm thành công',
            tasker: {
                id: user._id,
                name: user.fullName,
                email: user.email,
                phone: user.phone,
                tempPassword,
            },
        };
    }

    // ================= REVENUE CHART =================
    async getRevenue(from: string, to: string) {
        return this.orderModel.aggregate([
            {
                $match: {
                    status: 'COMPLETED',
                    createdAt: {
                        $gte: new Date(from),
                        $lte: new Date(to),
                    },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { $sum: "$totalPrice" },
                },
            },
            { $sort: { _id: 1 } },
        ]);
    }

    // ================= ORDERS =================
    async getOrders(query: any) {
        const { page = 1, limit = 10, status } = query;

        const filter: any = {};
        if (status) filter.status = status;

        const [data, total] = await Promise.all([
            this.orderModel
                .find(filter)
                .populate('customerId', 'fullName phone email')
                .populate('taskerId', 'fullName phone email')
                .populate('serviceId', 'name')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<AdminOrderItem[]>(),

            this.orderModel.countDocuments(filter),
        ]);

        return {
            total,
            page,
            data: data.map((o) => {
                const presented = presentOrder(o);

                return {
                    id: o._id,
                    customer:
                        o.customerId && typeof o.customerId === "object"
                            ? o.customerId.fullName
                            : null,
                    customerPhone: (o.customerId as any)?.phone || "",
                    customerEmail: (o.customerId as any)?.email || "",
                    tasker: o.taskerId?.fullName,
                    startTime: o.startTime,
                    endTime: o.endTime,
                    serviceSnapshot: o.serviceSnapshot,
                    amount: o.totalPrice,
                    status: o.status,
                    paymentStatus: presented.paymentStatus,
                    isPaid: presented.isPaid,
                    paidAt: o.paidAt,
                    service: o.serviceSnapshot?.name,
                    createdAt: o.createdAt,
                    address: o.address || o.addressDetail || "",
                };
            }),
        };
    }

    // ================= TRANSACTIONS =================
    async getTransactions(query: any) {
        const { page = 1, limit = 10, type } = query;

        const filter: any = {};
        if (type) filter.type = type;

        const [data, total] = await Promise.all([
            this.txModel
                .find(filter)
                .populate('userId', 'fullName')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<AdminTransactionItem[]>(),

            this.txModel.countDocuments(filter),
        ]);

        return {
            total,
            page,
            data: data.map((tx) => ({
                id: tx._id,
                user: tx.userId?.fullName,
                amount: tx.amount,
                type: tx.type,
                status: tx.status,
                createdAt: tx.createdAt,
            })),
        };
    }

    async getUsers(query: any) {
        const { page = 1, limit = 10, role, provinceId, wardId } = query;

        const filter: any = {};
        if (role) filter.role = role;

        if (provinceId && provinceId !== "all") {
            filter.provinceId = new Types.ObjectId(provinceId);
        }

        if (wardId && wardId !== "all") {
            filter.wardId = new Types.ObjectId(wardId);
        }

        const [data, total] = await Promise.all([
            this.userModel
                .find(filter)
                .populate('provinceId', 'name')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),

            this.userModel.countDocuments(filter),
        ]);

        const usersWithOrders = await Promise.all(
            data.map(async (u) => {
                const orderCount = await this.orderModel.countDocuments({
                    customerId: u._id,
                });

                // Tính tổng chi tiêu cho CUSTOMER
                let totalSpent = 0;
                if (role === 'CUSTOMER') {
                    const result = await this.orderModel.aggregate([
                        { $match: { customerId: u._id, status: 'COMPLETED' } },
                        { $group: { _id: null, total: { $sum: "$totalPrice" } } }
                    ]);
                    totalSpent = result[0]?.total ?? 0;
                }

                // Tính earnings cho TASKER từ completed orders
                let earnings = 0;
                if (role === 'TASKER') {
                    const result = await this.orderModel.aggregate([
                        { $match: { taskerId: u._id, status: 'COMPLETED' } },
                        { $group: { _id: null, total: { $sum: "$totalPrice" } } }
                    ]);
                    earnings = result[0]?.total ?? 0;
                }

                // Build address từ province + ward
                const provinceName = (u.provinceId as any)?.name || "";
                const wardName = (u.wardId as any)?.name || "";
                const address = buildFullAddress(provinceName, wardName);

                return {
                    ...u,
                    orders: orderCount,
                    totalSpent,
                    earnings,
                    address,
                };
            })
        );

        return {
            total,
            page,
            data: usersWithOrders.map((u: any) => ({
                id: u._id.toString(),
                name: u.fullName,
                email: u.email,
                phone: u.phone,
                skills: u.skills || [],
                provinceId: u.provinceId?._id?.toString() || u.provinceId?.toString() || "",
                wardId: u.wardId?._id?.toString() || u.wardId?.toString() || "",
                provinceName: (u.provinceId as any)?.name || "",
                wardName: (u.wardId as any)?.name || "",
                rating: u.rating || 0,
                completedJobs: u.totalJobs || 0,
                status: u.status,
                verified: u.isEmailVerified,
                role: u.role,
                orders: u.orders || 0,
                createdAt: u.createdAt,
                totalSpent: u.totalSpent || 0,
                address: u.address || "",
                idCard: u.idCard || "",
                earnings: u.earnings || 0,
                avatar: u.avatar || "",
            }))
        };
    };

    // ================= TOP TASKERS =================
    async getTopTaskers() {
        return this.userModel
            .find({ role: 'TASKER' })
            .sort({ rating: -1, totalJobs: -1 })
            .limit(5)
            .select('fullName rating totalJobs avatar')
            .lean();
    }

    async approveTasker(id: string) {
        const user = await this.userModel.findByIdAndUpdate(
            id,
            { status: 'ACTIVE', isEmailVerified: true },
            { new: true }
        );

        if (!user) {
            throw new NotFoundException('Tasker not found');
        }

        const mapped = {
            id: user._id.toString(),
            name: user.fullName,
            status: 'ACTIVE',
            verified: true,
        };

        // 🔥 EMIT REALTIME
        this.adminGateway.emitTaskerUpdated(mapped);

        return mapped;
    }

    async banTasker(id: string) {
        const user = await this.userModel.findByIdAndUpdate(
            id,
            { status: 'BLOCKED' },
            { new: true }
        );

        if (!user) {
            throw new NotFoundException('Tasker not found');
        }

        const mapped = {
            id: user._id.toString(),
            status: 'banned',
        };

        this.adminGateway.emitTaskerUpdated(mapped);

        return mapped;
    }

    async activateTasker(id: string) {
        const user = await this.userModel.findByIdAndUpdate(
            id,
            { status: 'ACTIVE' },
            { new: true }
        );

        if (!user) {
            throw new NotFoundException('Tasker not found');
        }

        const mapped = {
            id: user._id.toString(),
            status: 'active',
        };

        this.adminGateway.emitTaskerUpdated(mapped);

        return mapped;
    }

    async rejectTasker(id: string) {
        const user = await this.userModel.findByIdAndDelete(id);

        if (!user) {
            throw new NotFoundException('Tasker not found');
        }

        this.adminGateway.emitTaskerDeleted(id);

        return { id };
    }

    async banUser(id: string) {
        const user = await this.userModel.findByIdAndUpdate(
            id,
            { status: 'BLOCKED' },
            { new: true },
        );

        if (!user) {
            throw new NotFoundException('User not found');
        }

        this.adminGateway.emitUserUpdated(user);

        return {
            id: user._id.toString(),
            status: user.status,
        };
    }

    async activateUser(id: string) {
        const user = await this.userModel.findByIdAndUpdate(
            id,
            { status: 'ACTIVE' },
            { new: true },
        );

        if (!user) {
            throw new NotFoundException('User not found');
        }

        this.adminGateway.emitUserUpdated(user);

        return {
            id: user._id.toString(),
            status: user.status,
        };
    }

    private async emitAdminUserUpdate(userId: Types.ObjectId | string) {
        const user = (await this.userModel
            .findById(userId)
            .populate('provinceId', 'name')
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

    private async emitAdminOrderUpdate(orderId: Types.ObjectId | string) {
        const order = await this.orderModel
            .findById(orderId)
            .populate('customerId', 'fullName phone email')
            .populate('taskerId', 'fullName phone email')
            .lean();

        if (order) {
            this.adminGateway.emitOrderUpdated(presentOrder(order));
        }
    }

    async confirmOrderByAdmin(id: string) {
        const order = await this.orderModel.findById(id);
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.COMPLETED) {
            throw new BadRequestException('Cannot confirm this order');
        }

        order.status = OrderStatus.ASSIGNED;
        await order.save();
        await this.emitAdminOrderUpdate(order._id as Types.ObjectId);

        return order;
    }

    async cancelOrderByAdmin(id: string) {
        const order = await this.orderModel.findById(id);
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.status === OrderStatus.COMPLETED) {
            throw new BadRequestException('Cannot cancel completed order');
        }

        order.status = OrderStatus.CANCELLED;
        await order.save();
        await this.emitAdminOrderUpdate(order._id as Types.ObjectId);

        return order;
    }

    async completeOrderByAdmin(id: string) {
        const order = await this.orderModel.findById(id);
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        order.status = OrderStatus.COMPLETED;
        if (!order.completedAt) {
            order.completedAt = new Date();
        }

        await order.save();
        await this.emitAdminOrderUpdate(order._id as Types.ObjectId);

        return order;
    }
}
