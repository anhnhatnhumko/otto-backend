// import { Injectable } from '@nestjs/common';
// import { redisClient } from '../redis.config';

// @Injectable()
// export class PresenceService {

//   async setOnline(userId: string) {
//     console.log("REDIS SADD:", userId);

//     await redisClient.sadd('online:taskers', userId);

//     const all = await redisClient.smembers('online:taskers');
//     console.log("REDIS AFTER SADD:", all);
//   }

//   async setOffline(userId: string) {
//     await redisClient.srem('online:taskers', userId);
//     console.log('TASKER SET OFFLINE:', userId);
//   }

//   async getOnlineTaskers(): Promise<string[]> {
//     const onlineTaskers = await redisClient.smembers('online:taskers');
//     console.log('ONLINE TASKERS:', onlineTaskers);
//     return onlineTaskers;
//   }
// }