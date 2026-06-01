import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePublicOrderDto } from './dto/create-public-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { AnalyticsPeriod, OrderAnalyticsQueryDto } from './dto/order-analytics-query.dto';
import { PrismaService } from '../database/database.service';
import { Prisma, OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly orderInclude = {
    user: true,
    coupon: true,
    shippingAddress: true,
    contact: true,
    payment: true,
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

  // ── Checkout (invitado o autenticado) ─────────────────────────────────────
  // Guarda al comprador como `customer` (lo crea si no existe por email), crea
  // su Contact, su Address de envío y el Payment, y deja el pedido en PENDING.
  // El precio y el total se calculan en el servidor a partir de los productos;
  // el cliente NUNCA envía precios. Si llega un `authUser` (token válido) se
  // asocia el pedido a su cuenta sin sobrescribir su perfil.
  async createCheckout(
    dto: CreatePublicOrderDto,
    authUser?: { id: string; password?: string | null } | null,
  ) {
    const { items, couponId } = dto;
    const email = dto.email.toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      // 1) Cargar los productos referenciados y validar que todos existan.
      const productIds = items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, price: true },
      });

      const productById = new Map(products.map((p) => [p.id, p]));
      const missing = productIds.filter((id) => !productById.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(`Productos no encontrados: ${missing.join(', ')}`);
      }

      // 2) Determinar al comprador.
      //    - Autenticado (token): se usa su id; NO se toca su perfil.
      //    - Invitado: emparejado por email.
      //        · no existe → se crea como invitado (sin contraseña) rol customer.
      //        · existe pero invitado (sin contraseña) → se refrescan sus datos.
      //        · existe con contraseña → sólo se le asocia el pedido (no se toca).
      let userId: string;
      if (authUser?.id) {
        userId = authUser.id;
      } else {
        const existing = await tx.user.findUnique({
          where: { email },
          select: { id: true, password: true },
        });

        if (!existing) {
          const created = await tx.user.create({
            data: {
              email,
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone,
              address: dto.address,
              city: dto.city ?? '',
              state: dto.state ?? '',
              zip: dto.zip ?? '',
              country: dto.country ?? 'Venezuela',
              role: 'customer',
            },
            select: { id: true },
          });
          userId = created.id;
        } else {
          userId = existing.id;
          if (!existing.password) {
            await tx.user.update({
              where: { id: existing.id },
              data: {
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone,
                address: dto.address,
                ...(dto.city !== undefined ? { city: dto.city } : {}),
                ...(dto.state !== undefined ? { state: dto.state } : {}),
                ...(dto.zip !== undefined ? { zip: dto.zip } : {}),
                ...(dto.country !== undefined ? { country: dto.country } : {}),
              },
            });
          }
        }
      }

      // 3) Upsert del Contact (emparejado por email).
      const contact = await tx.contact.upsert({
        where: { email },
        create: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email,
          phone: dto.phone,
          userId,
        },
        update: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          userId,
        },
      });
      const contactId = contact.id;

      // 4) Crear la dirección de envío vinculada al usuario.
      const address = await tx.address.create({
        data: {
          userId,
          label: dto.addressLabel ?? null,
          recipientName: `${dto.firstName} ${dto.lastName}`.trim(),
          phone: dto.phone,
          line1: dto.address,
          city: dto.city ?? '',
          state: dto.state ?? '',
          zip: dto.zip ?? '',
          country: dto.country ?? 'Venezuela',
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
        },
      });
      const shippingAddressId = address.id;

      // 5) Construir los items con el precio del servidor y calcular el total.
      const orderItems = items.map((item) => {
        const product = productById.get(item.productId)!;
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        };
      });

      const total = orderItems.reduce(
        (acc, item) => acc.plus(new Prisma.Decimal(item.price).times(item.quantity)),
        new Prisma.Decimal(0),
      );

      // 6) Construir los datos del pago.
      const paymentData: Prisma.PaymentCreateWithoutOrderInput = {
        method: dto.paymentMethod,
        status: 'PENDING',
        amount: total,
        currency: 'USD',
      };
      if (dto.paymentMethod === 'pago_movil') {
        paymentData.reference = dto.paymentReference ?? null;
        paymentData.payerIdDocument = dto.payerIdDocument ?? null;
        paymentData.payerName = dto.payerName ?? null;
        paymentData.payerPhone = dto.payerPhone ?? null;
        paymentData.bank = 'R4';
        paymentData.bcvRate = dto.bcvRate ?? null;
        paymentData.amountVes = dto.bcvRate
          ? new Prisma.Decimal(total).times(dto.bcvRate)
          : null;
      }

      // 7) Crear el pedido en estado PENDING con sus items y su pago.
      return tx.order.create({
        data: {
          userId,
          status: OrderStatus.PENDING,
          discount: 0,
          ...(couponId ? { couponId } : {}),
          total,
          shipping: 0,
          notes: dto.notes ?? null,
          shippingAddressId,
          contactId,
          items: {
            create: orderItems,
          },
          payment: {
            create: paymentData,
          },
        },
        include: this.orderInclude,
      });
    });
  }

  // Pedidos del cliente autenticado, del más reciente al más antiguo.
  findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: this.orderInclude,
      orderBy: { createdAt: 'desc' },
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

  async getAnalytics(dto: OrderAnalyticsQueryDto) {
    const now = new Date().getFullYear();
    const { period, year = now, yearFrom = 2020, yearTo = now } = dto;

    const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const sum = (rows: { total: Prisma.Decimal }[]) =>
      rows.reduce((acc, r) => acc + parseFloat(r.total.toString()), 0);

    if (period === AnalyticsPeriod.ANNUAL) {
      const orders = await this.prisma.order.findMany({
        where: {
          status: { not: OrderStatus.CANCELLED },
          createdAt: {
            gte: new Date(yearFrom, 0, 1),
            lte: new Date(yearTo, 11, 31, 23, 59, 59),
          },
        },
        select: { createdAt: true, total: true },
      });

      return Array.from({ length: yearTo - yearFrom + 1 }, (_, i) => {
        const y = yearFrom + i;
        const rows = orders.filter((o) => o.createdAt.getFullYear() === y);
        return { label: String(y), ventas: rows.length, ingresos: sum(rows) };
      });
    }

    const orders = await this.prisma.order.findMany({
      where: {
        status: { not: OrderStatus.CANCELLED },
        createdAt: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31, 23, 59, 59),
        },
      },
      select: { createdAt: true, total: true },
    });

    if (period === AnalyticsPeriod.MONTHLY) {
      return MONTHS.map((label, i) => {
        const rows = orders.filter((o) => o.createdAt.getMonth() === i);
        return { label, ventas: rows.length, ingresos: sum(rows) };
      });
    }

    if (period === AnalyticsPeriod.QUARTERLY) {
      return [0, 1, 2, 3].map((q) => {
        const rows = orders.filter((o) => Math.floor(o.createdAt.getMonth() / 3) === q);
        return { label: `Q${q + 1}`, ventas: rows.length, ingresos: sum(rows) };
      });
    }

    // SEMIANNUAL
    return [0, 1].map((h) => {
      const rows = orders.filter((o) => (o.createdAt.getMonth() < 6 ? 0 : 1) === h);
      return { label: `H${h + 1}`, ventas: rows.length, ingresos: sum(rows) };
    });
  }
}
