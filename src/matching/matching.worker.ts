// import { Worker } from 'bullmq';
// import mongoose from 'mongoose';
// import { redisClient, redisConnection } from '../redis.config';
// import { PresenceService } from './presence.service';
// import { OrderSchema } from '../orders/order.schema';
// import { UserSchema } from '../users/user.schema';
// import { OrderStatus } from '../orders/order-status.enum';
// import { matchingQueue } from './matching.queue';
// import { matchingGateway } from './matching.gateway.instance';

// const presence = new PresenceService();

// mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/otto');

// console.log("MATCHING WORKER STARTED");

// const OrderModel = mongoose.model('Order', OrderSchema);
// const UserModel = mongoose.model('User', UserSchema);

// new Worker(
//   'order-matching',
//   async job => {

//     const { orderId } = job.data;

//     const order = await OrderModel.findById(orderId);
//     if (!order) return;

//     console.log("MATCHING:", orderId, "STATUS:", order.status);

//     // ===== STOP nếu đã assign =====
//     if (
//       order.status === OrderStatus.ASSIGNED ||
//       order.status === OrderStatus.IN_PROGRESS ||
//       order.status === OrderStatus.COMPLETED
//     ) {
//       console.log("ORDER ALREADY TAKEN");
//       return;
//     }

//     // ===== HANDLE OFFERING TIMEOUT =====
//     if (order.status === OrderStatus.OFFERING) {

//       console.log("RESET OFFERING → SEARCHING");

//       order.status = OrderStatus.SEARCHING;
//       order.offerRound = 0;

//       await order.save();

//       console.log("OFFER EXPIRED → REMATCH");

//       order.status = OrderStatus.SEARCHING;
//       await order.save();

//       matchingGateway?.emitOrderUpdate(order.customerId.toString(), order);
//     }

//     if (order.status !== OrderStatus.SEARCHING) return;

//     // ===== ONLINE TASKERS =====
//     const online = await presence.getOnlineTaskers();
//     console.log("ONLINE TASKERS:", online);

//     if (!online.length) {
//       console.log("NO TASKER ONLINE → RETRY");

//       await matchingQueue.add('match-order', { orderId }, { delay: 5000 });
//       return;
//     }

//     const onlineIds = online.map(id => new mongoose.Types.ObjectId(id));

//     // ===== TASKER BẬN =====
//     const busyTaskersRaw = await OrderModel.find({
//       status: {
//         $in: [OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS],
//       },
//       startTime: { $lt: order.endTime },
//       endTime: { $gt: order.startTime },
//     }).distinct("taskerId");

//     const busyTaskers = busyTaskersRaw
//       .filter(Boolean)
//       .map(id => new mongoose.Types.ObjectId(id));

//     const rejected = (order.rejectedTaskers || []).map(
//       id => new mongoose.Types.ObjectId(id),
//     );

//     // ===== FIND MULTIPLE TASKERS =====
//     const candidates = await UserModel.find({
//       _id: {
//         $in: onlineIds,
//         $nin: [...busyTaskers, ...rejected],
//       },
//       role: 'TASKER',
//       wardId: new mongoose.Types.ObjectId(order.wardId),
//       skills: {
//         $in: [new mongoose.Types.ObjectId(order.serviceId)],
//       },
//     })
//       .sort({ rating: -1 })
//       .limit(5);

//     console.log("CANDIDATES:", candidates.map(c => c._id.toString()));

//     if (!candidates.length) {
//       console.log("NO MATCHED TASKER → RETRY");

//       await matchingQueue.add('match-order', { orderId }, { delay: 5000 });
//       return;
//     }

//     // ===== UPDATE ORDER =====
//     const OFFER_TIMEOUT = 15000;

//     order.status = OrderStatus.OFFERING;
//     order.offerExpiresAt = new Date(Date.now() + OFFER_TIMEOUT);

//     await order.save();

//     matchingGateway?.emitOrderUpdate(order.customerId.toString(), order);

//     // ===== 🔥 GỬI CHO NHIỀU TASKER =====
//     for (const tasker of candidates) {
//       console.log("SEND TO TASKER:", tasker._id.toString());

//       await redisClient.publish(
//         "matching:offer",
//         JSON.stringify({
//           taskerId: tasker._id.toString(),
//           order,
//         }),
//       );
//     }

//     // ===== NEXT ROUND =====
//     await matchingQueue.add(
//       'match-order',
//       { orderId },
//       { delay: OFFER_TIMEOUT },
//     );
//   },
//   {
//     connection: redisConnection,
//     concurrency: 1,
//   },
// );