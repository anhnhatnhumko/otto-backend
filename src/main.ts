// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { ValidationPipe } from '@nestjs/common';
// import cookieParser from 'cookie-parser';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule, { rawBody: true });

//   app.use(cookieParser());

//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       forbidNonWhitelisted: true,
//       transform: true,
//     }),
//   );

//   const envOrigins = (process.env.FRONTEND_URL || '')
//     .split(/[\s,]+/)
//     .map((origin) => origin.trim())
//     .filter(Boolean);

//   const allowedOrigins = new Set([
//     'http://localhost:3000',
//     'http://localhost:3001',
//     'https://alert-enjoyment-production-5414.up.railway.app',
//     'https://ottohome.online',
//     'https://www.ottohome.online',
//     ...envOrigins,
//   ]);

//   app.enableCors({
//     origin: (origin, callback) => {
//       if (!origin || allowedOrigins.has(origin)) {
//         callback(null, true);
//         return;
//       }

//       callback(new Error(`CORS blocked for origin: ${origin}`), false);
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
//   });

//   const port = Number(process.env.PORT) || 9999;

//   await app.listen(port, '0.0.0.0');

//   console.log(`Server running on ${port}`);
// }
// bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  console.log('BOOT STEP 1');

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  console.log('BOOT STEP 2');

  app.use(cookieParser());

  console.log('BOOT STEP 3');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  console.log('BOOT STEP 4');

  const envOrigins = (process.env.FRONTEND_URL || '')
    .split(/[\s,]+/)
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://alert-enjoyment-production-5414.up.railway.app',
    'https://ottohome.online',
    'https://www.ottohome.online',
    ...envOrigins,
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  console.log('BOOT STEP 5');

  const port = Number(process.env.PORT) || 9999;

  await app.listen(port, '0.0.0.0');

  console.log('BOOT STEP 6');
  console.log(`Server running on ${port}`);
}

bootstrap();