import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
    cors: { origin: '*' },
})
export class AdminGateway implements OnGatewayConnection {
    @WebSocketServer()
    server: Server;

    handleConnection(client: Socket) {
        const roleFromAuth = String(client.handshake.auth?.role ?? '').toUpperCase();
        const roleFromQuery = String(client.handshake.query?.role ?? '').toUpperCase();
        const userIdFromAuth = String(client.handshake.auth?.userId ?? '');
        const userIdFromQuery = String(client.handshake.query?.userId ?? '');

        const role = roleFromAuth || roleFromQuery;
        const userId = userIdFromAuth || userIdFromQuery;

        // 🔥 AUTO JOIN ADMIN TO ADMIN ROOM
        if (role === 'ADMIN') {
            client.join('admin');
        }

        // 🔥 AUTO JOIN TASKER/CUSTOMER TO USER ROOM FOR REALTIME NOTIFICATIONS
        if (userId) {
            const userRoomName = `user-${userId}`;
            client.join(userRoomName);
            console.log(`✅ User ${userId} joined room: ${userRoomName}`);
        }
    }

    @SubscribeMessage('admin:join')
    handleAdminJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { role?: string },
    ) {
        const role = String(payload?.role ?? '').toUpperCase();
        if (role === 'ADMIN') {
            client.join('admin');
        }
    }

    @SubscribeMessage('order:join')
    handleOrderJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { orderId?: string; userId?: string },
    ) {
        const orderId = String(payload?.orderId ?? '');
        if (orderId) {
            const roomName = `order-${orderId}`;
            client.join(roomName);
        }
    }

    private emitToAdmins(eventName: string, payload: unknown) {
        this.server.to('admin').emit(eventName, payload);
    }

    private emitToOrderRoom(orderId: string, eventName: string, payload: unknown) {
        if (orderId) {
            const roomName = `order-${orderId}`;
            this.server.to(roomName).emit(eventName, payload);
        }
    }

    // ================= USER =================
    emitUserUpdated(user: any) {
        this.emitToAdmins('admin:user-updated', user);
        this.emitToAdmins('admin:users:updated', user);
    }

    emitUserCreated(user: any) {
        this.emitToAdmins('admin:user-created', user);
        this.emitToAdmins('admin:users:created', user);
    }

    emitUserDeleted(id: string) {
        const payload = { id, _id: id };
        this.emitToAdmins('admin:user-deleted', payload);
        this.emitToAdmins('admin:users:deleted', payload);
    }

    // ================= SERVICE =================
    emitServiceUpdated(service: any) {
        this.emitToAdmins('admin:service-updated', service);
        this.emitToAdmins('admin:services:updated', service);
    }

    emitServiceCreated(service: any) {
        this.emitToAdmins('admin:service-created', service);
        this.emitToAdmins('admin:services:created', service);
    }

    emitServiceDeleted(id: string) {
        const payload = { id, _id: id };
        this.emitToAdmins('admin:service-deleted', payload);
        this.emitToAdmins('admin:services:deleted', payload);
    }

    // ================= TASKER =================
    emitTaskerUpdated(tasker: any) {
        this.emitToAdmins('admin:tasker-updated', tasker);
        this.emitToAdmins('admin:taskers:updated', tasker);
    }

    emitTaskerDeleted(id: string) {
        const payload = { id };
        this.emitToAdmins('admin:tasker-deleted', payload);
        this.emitToAdmins('admin:taskers:deleted', payload);
    }

    // ================= ORDER =================
    emitNewOrder(order: any) {
        this.emitToAdmins('admin:new-order', order);
        this.emitToAdmins('admin:orders:created', order);
    }

    emitOrderUpdated(order: any) {
        const orderId = String(order?._id ?? order?.id ?? order?.orderId ?? '');
        const status = order?.status;
        const paymentStatus = order?.paymentStatus;
        const isPaid = order?.isPaid;

        this.emitToAdmins('admin:order-updated', order);
        this.emitToAdmins('admin:orders:updated', order);
        this.emitToAdmins('order:updated', order);
        this.emitToOrderRoom(orderId, 'order:updated', order);

        if (orderId || status) {
            const statusPayload = {
                orderId,
                id: orderId,
                status,
                paymentStatus,
                isPaid,
                data: order,
            };

            this.emitToAdmins('admin:order-status-updated', statusPayload);
            this.emitToAdmins('admin:orders:status-updated', statusPayload);
            this.emitToAdmins('order:status-updated', statusPayload);
            this.emitToOrderRoom(orderId, 'order:status-updated', statusPayload);
        }
    }

    emitOrderStatusUpdated(payload: { id?: string; _id?: string; orderId?: string; status?: string }) {
        const orderId = String(payload.orderId ?? payload.id ?? payload._id ?? '');
        const statusPayload = {
            ...payload,
            orderId,
            id: orderId,
        };

        this.emitToAdmins('admin:order-status-updated', statusPayload);
        this.emitToAdmins('admin:orders:status-updated', statusPayload);
        this.emitToAdmins('order:status-updated', statusPayload);
        this.emitToOrderRoom(orderId, 'order:status-updated', statusPayload);
    }

    emitOrderCancelled(payload: { orderId: string; taskerId: string; customerId: string; serviceName: string }) {
        const { orderId, taskerId, customerId, serviceName } = payload;

        console.log(`🔥 emitOrderCancelled called for order ${orderId}, taskerId: ${taskerId}`);

        // Emit to admin dashboard
        this.emitToAdmins('admin:order-cancelled', payload);

        // Emit to order room (for realtime tracking)
        this.emitToOrderRoom(orderId, 'order:cancelled', payload);

        // Emit to tasker (for immediate notification)
        this.server.to(`user-${taskerId}`).emit('order:cancelled', payload);
        console.log(`📨 Emitted order:cancelled to user-${taskerId}`);

        // Emit to customer
        this.server.to(`user-${customerId}`).emit('order:cancelled-confirmed', payload);
    }

    emitOrderKept(payload: { orderId: string; taskerId: string; customerId: string; serviceName: string }) {
        const { orderId, taskerId, customerId, serviceName } = payload;

        // Emit to admin dashboard
        this.emitToAdmins('admin:order-kept', payload);

        // Emit to order room
        this.emitToOrderRoom(orderId, 'order:kept', payload);

        // Emit to tasker (for immediate notification that order is active again)
        this.server.to(`user-${taskerId}`).emit('order:kept', payload);

        // Emit to customer
        this.server.to(`user-${customerId}`).emit('order:kept-confirmed', payload);
    }
}
