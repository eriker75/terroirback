import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreatePublicOrderDto } from './dto/create-public-order.dto';
import { OptionalJwtAuthGuard } from '../users/guards/optional-jwt.guard';

@ApiTags('orders')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @ApiOperation({
    summary:
      'Checkout público (invitado): registra al comprador como customer y crea el pedido (PENDING)',
  })
  @ApiResponse({ status: 201, description: 'Pedido creado en estado PENDING.' })
  create(@Body() dto: CreatePublicOrderDto, @Req() req: Request) {
    return this.ordersService.createCheckout(dto, (req as any).user ?? null);
  }
}
