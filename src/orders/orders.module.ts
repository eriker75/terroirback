import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CheckoutController } from './checkout.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [OrdersController, CheckoutController],
  providers: [OrdersService],
})
export class OrdersModule {}
