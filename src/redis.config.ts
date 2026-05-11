import { Redis } from 'ioredis';
import { RedisOptions } from 'ioredis';

export const redisConnection: RedisOptions = {
  host: '127.0.0.1',
  port: 6379,
};

export const redisClient = new Redis(redisConnection);