// import {
//   WebSocketGateway,
//   WebSocketServer,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
//   OnGatewayInit,
// } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import { PresenceService } from './presence.service';
// import { setGatewayInstance } from './matching.gateway.instance';
// import { redisClient } from '../redis.config';
// import { JwtService } from '@nestjs/jwt';
// import * as cookie from "cookie";

// @WebSocketGateway({
//   cors: {
//     origin: 'http://localhost:3000',
//     credentials: true,
//   },
// })
// export class MatchingGateway
//   implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
//   @WebSocketServer()
//   server: Server;

//   private subscriber;

//   constructor(
//     private presence: PresenceService,
//     private jwtService: JwtService,
//   ) { }

//   async afterInit() {
//     setGatewayInstance(this);

//     console.log('MATCHING GATEWAY READY');

//     // ✅ Tạo subscriber riêng (tránh conflict)
//     this.subscriber = redisClient.duplicate();

//     await this.subscriber.subscribe(
//       'matching:offer',
//       (message: string) => {
//         try {
//           if (!message) {
//             console.log("❌ EMPTY MESSAGE");
//             return;
//           }

//           const data = JSON.parse(message);

//           if (!data || !data.taskerId) {
//             console.log("❌ INVALID DATA:", data);
//             return;
//           }

//           console.log('REDIS OFFER -> TASKER:', data.taskerId);

//           this.server
//             .to(data.taskerId)
//             .emit('order:offer', data.order);

//         } catch (err) {
//           console.log("❌ PARSE ERROR:", err.message);
//           console.log("RAW MESSAGE:", message);
//         }
//       }
//     );
//   }

//   // ========================
//   // SOCKET CONNECT
//   // ========================
//   async handleConnection(client: Socket) {
//     console.log("🔥 HANDLE CONNECTION CALLED");
//     try {
//       console.log("🔥 NEW SOCKET CONNECT");

//       const rawCookie = client.handshake.headers.cookie;

//       console.log("RAW COOKIE:", rawCookie);

//       if (!rawCookie) {
//         console.log("❌ NO COOKIE -> DISCONNECT");
//         client.disconnect();
//         return;
//       }

//       const parsed = cookie.parse(rawCookie);

//       const token = parsed.accessToken;

//       const secret = process.env.JWT_SECRET || 'secret';
//       console.log("VERIFY SECRET:", secret);

//       if (!token) {
//         console.log("❌ NO TOKEN -> DISCONNECT");
//         client.disconnect();
//         return;
//       }

//       const payload = this.jwtService.verify(token);

//       console.log("JWT PAYLOAD:", payload);

//       const userId = payload.sub;
//       const role = payload.role;

//       client.data.user = payload;

//       client.join(userId);

//       if (role === 'TASKER') {
//         await this.presence.setOnline(userId);
//       }

//       console.log("✅ SOCKET CONNECT:", { userId, role });

//     } catch (err) {
//       console.log("❌ SOCKET AUTH FAILED:", err.message);
//       client.disconnect();
//     }
//   }

//   // ========================
//   // SOCKET DISCONNECT
//   // ========================
//   async handleDisconnect(client: Socket) {
//     try {
//       const user = client.data.user;

//       if (!user) return;

//       const userId = user.userId;
//       const role = user.role;

//       if (role === 'TASKER') {
//         await this.presence.setOffline(userId);
//       }

//       console.log('SOCKET DISCONNECT:', userId);

//     } catch (err) {
//       console.log('DISCONNECT ERROR:', err);
//     }
//   }

//   // ========================
//   // EMIT ORDER UPDATE
//   // ========================
//   emitOrderUpdate(customerId: string, order: any) {
//     this.server
//       .to(customerId)
//       .emit('order:updated', order);
//   }

//   // ========================
//   // EMIT OFFER (fallback)
//   // ========================
//   sendOffer(taskerId: string, order: any) {
//     console.log('EMIT OFFER DIRECT:', taskerId);

//     this.server
//       .to(taskerId)
//       .emit('order:offer', order);
//   }
// }