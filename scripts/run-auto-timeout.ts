import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { OrdersModule } from '../src/orders/orders.module';
import { OrdersService } from '../src/orders/orders.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const ordersService = app.select(OrdersModule).get(OrdersService, { strict: false });

  if (!ordersService || typeof ordersService.handleTimeoutOrders !== 'function') {
    console.error('OrdersService or handleTimeoutOrders not found in OrdersModule');
    await app.close();
    process.exit(1);
  }

  try {
    console.log('Running handleTimeoutOrders()...');
    const result = await ordersService.handleTimeoutOrders();
    console.log('handleTimeoutOrders result:', result);
  } catch (err) {
    console.error('Error running handleTimeoutOrders:', err);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
