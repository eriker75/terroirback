import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { PrismaService } from '../database/database.service';
import { Prisma, OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly orderInclude = {
    user: true,
    coupon: true,
    items: {
      include: {
        product: true,
      },
    },
  } as const;

  create(createOrderDto: CreateOrderDto) {
    const { items, ...orderData } = createOrderDto;

    return this.prisma.order.create({
      data: {
        ...orderData,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: this.orderInclude,
    });
  }

  async findAll({ limit, offset, status, dateFrom, dateTo, minTotal, maxTotal, search }: OrderQueryDto) {
    const where: Prisma.OrderWhereInput = {};

    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
      };
    }

    if (minTotal !== undefined || maxTotal !== undefined) {
      where.total = {
        ...(minTotal !== undefined ? { gte: minTotal } : {}),
        ...(maxTotal !== undefined ? { lte: maxTotal } : {}),
      };
    }

    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, total, limit, offset };
  }

  async getOrderStats() {
    const statuses = [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.CANCELLED];
    const counts = await this.prisma.$transaction(
      statuses.map((s) => this.prisma.order.count({ where: { status: s } })),
    );
    return {
      PENDING: counts[0],
      PAID: counts[1],
      SHIPPED: counts[2],
      CANCELLED: counts[3],
      total: counts.reduce((a, b) => a + b, 0),
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude,
    });

    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }

    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    await this.findOne(id);

    const { items, ...orderData } = updateOrderDto;

    return this.prisma.order.update({
      where: { id },
      data: {
        ...orderData,
        items: items
          ? {
              deleteMany: {},
              create: items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
              })),
            }
          : undefined,
      },
      include: this.orderInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.order.delete({
      where: { id },
    });
  }
}
