import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePublicOrderDto } from './dto/create-public-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { AnalyticsPeriod, OrderAnalyticsQueryDto } from './dto/order-analytics-query.dto';
import { PrismaService } from '../database/database.service';
import { BcvService } from '../bcv/bcv.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { Prisma, OrderStatus } from '@prisma/client';

// Puntos que otorga una unidad de producto. Si el producto define `pointsEarned`
// se usa ese valor; si no, se aplica la tasa por defecto (1 USD → 10 pts), que
// es la misma que muestra la web en la ficha de producto.
const DEFAULT_POINTS_PER_USD = 10;
function pointsForUnit(price: Prisma.Decimal, pointsEarned: number | null): number {
  if (pointsEarned != null) return Math.max(0, Math.floor(pointsEarned));
  return Math.floor(Number(price) * DEFAULT_POINTS_PER_USD);
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcvService: BcvService,
    private readonly loyalty: LoyaltyService,
  ) {}

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

    // La tasa BCV se calcula SIEMPRE en el servidor (el `bcvRate` del cliente se
    // ignora). Sólo es relevante para pago_movil.
    const bcv = await this.bcvService.getRateValue();

    // Normaliza un código de banco a 4 dígitos; null si no hay dígitos.
    const norm = (c?: string) => {
      const d = (c ?? '').replace(/\D/g, '');
      return d ? d.padStart(4, '0') : null;
    };

    return this.prisma.$transaction(async (tx) => {
      // 1) Cargar los productos referenciados y validar que todos existan.
      const productIds = items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, price: true, stock: true, pointsEarned: true },
      });

      const productById = new Map(products.map((p) => [p.id, p]));
      const missing = productIds.filter((id) => !productById.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(`Productos no encontrados: ${missing.join(', ')}`);
      }

      // 1b) Validar disponibilidad de stock ANTES de cobrar/crear nada. Se
      //     consolidan cantidades por si un producto llega repetido en `items`.
      const qtyByProduct = new Map<string, number>();
      for (const item of items) {
        qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
      }
      for (const [pid, qty] of qtyByProduct) {
        const product = productById.get(pid)!;
        if (product.stock < qty) {
          throw new BadRequestException(
            `Stock insuficiente para "${product.name}": disponibles ${product.stock}, solicitados ${qty}`,
          );
        }
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

      // PostGIS DESHABILITADO (diferido): la columna `addresses.location` está
      // comentada en el schema porque requiere la extensión `postgis`. Lat/lng ya
      // se guardan en columnas Float. Para reactivar: habilita postgis, descomenta
      // la columna en el schema y este bloque — IDEALMENTE FUERA de la transacción
      // (con this.prisma.$executeRaw + try/catch) para que un fallo de PostGIS
      // nunca revierta una orden válida:
      // if (dto.latitude != null && dto.longitude != null) {
      //   await this.prisma.$executeRaw`UPDATE addresses SET location = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography WHERE id = ${address.id}`;
      // }

      // 5) Construir los items con el precio del servidor y calcular el subtotal.
      const orderItems = items.map((item) => {
        const product = productById.get(item.productId)!;
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        };
      });

      const subtotal = orderItems.reduce(
        (acc, item) => acc.plus(new Prisma.Decimal(item.price).times(item.quantity)),
        new Prisma.Decimal(0),
      );

      // 5b) Cupón: SIEMPRE se re-valida en el servidor (nunca se confía en el
      //     descuento que envíe el cliente). Se calcula el descuento real y se
      //     incrementa su contador de uso de forma atómica dentro de la transacción.
      let discount = new Prisma.Decimal(0);
      let validCouponId: string | undefined;
      if (couponId) {
        const coupon = await tx.coupon.findUnique({
          where: { id: couponId },
          include: { couponProducts: true },
        });
        if (!coupon) throw new BadRequestException('Cupón no encontrado');
        if (!coupon.isActive) throw new BadRequestException('El cupón está inactivo');
        if (coupon.expiryDate && coupon.expiryDate < new Date())
          throw new BadRequestException('El cupón está vencido');
        if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit)
          throw new BadRequestException('El cupón alcanzó su límite de uso');

        const allowed = coupon.couponProducts.map((cp) => cp.productId);
        if (allowed.length) {
          const invalid = productIds.filter((id) => !allowed.includes(id));
          if (invalid.length)
            throw new BadRequestException('El cupón no aplica a algunos productos del carrito');
        }

        discount =
          coupon.discountType === 'PERCENTAGE'
            ? subtotal.times(coupon.amount).dividedBy(100)
            : new Prisma.Decimal(coupon.amount);
        // El descuento nunca supera el subtotal ni baja de cero.
        if (discount.greaterThan(subtotal)) discount = subtotal;
        if (discount.lessThan(0)) discount = new Prisma.Decimal(0);
        validCouponId = coupon.id;

        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      const total = subtotal.minus(discount);

      // 5c) Puntos de fidelidad que otorgará el pedido (snapshot). Se acreditan
      //     al saldo del cliente sólo cuando el pedido pase a PAID (LoyaltyService).
      const pointsEarned = orderItems.reduce(
        (acc, item) =>
          acc +
          pointsForUnit(
            productById.get(item.productId)!.price,
            productById.get(item.productId)!.pointsEarned ?? null,
          ) * item.quantity,
        0,
      );

      // 5d) Descontar stock (ya validado en 1b). decrement es atómico en SQL.
      for (const [pid, qty] of qtyByProduct) {
        await tx.product.update({ where: { id: pid }, data: { stock: { decrement: qty } } });
      }

      // 6) Construir los datos del pago.
      //    - bcvRate/amountVes sólo tienen sentido para pago_movil.
      //    - El monto del pago es el TOTAL ya con el descuento del cupón aplicado.
      //    - bank = código del banco DEL CLIENTE (normalizado a 4 dígitos) para
      //      pago_movil; para efectivo/puntos/yummy queda sin asignar (null).
      const isPagoMovil = dto.paymentMethod === 'pago_movil';
      const paymentData: Prisma.PaymentCreateWithoutOrderInput = {
        method: dto.paymentMethod,
        status: 'PENDING',
        amount: total,
        currency: 'USD',
        bank: isPagoMovil ? norm(dto.bankCode) : null,
        amountVes: isPagoMovil ? new Prisma.Decimal(total).times(bcv) : null,
      };
      if (isPagoMovil) {
        paymentData.reference = dto.paymentReference ?? null;
        paymentData.payerIdDocument = dto.payerIdDocument ?? null;
        paymentData.payerName = dto.payerName ?? null;
        paymentData.payerPhone = dto.payerPhone ?? null;
        paymentData.bcvRate = bcv;
      }

      // 7) Crear el pedido en estado PENDING con sus items y su pago.
      return tx.order.create({
        data: {
          userId,
          status: OrderStatus.PENDING,
          discount,
          ...(validCouponId ? { couponId: validCouponId } : {}),
          total,
          shipping: 0,
          pointsEarned,
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

  // Seguimiento público: devuelve sólo un subconjunto seguro (sin email,
  // cédula, teléfono ni dirección) porque la ruta es pública.
  async findOneForTracking(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        items: {
          select: { id: true, quantity: true, price: true, product: { select: { name: true } } },
        },
        payment: { select: { method: true, status: true } },
      },
    });
    if (!order) throw new NotFoundException(`Pedido ${id} no encontrado`);
    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const current = await this.findOne(id); // 404 si no existe; trae items + status

    const { items, ...orderData } = updateOrderDto;
    const nextStatus = orderData.status as OrderStatus | undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Reponer stock al CANCELAR (transición hacia CANCELLED desde cualquier
      // otro estado). Se exige que el estado previo NO fuera ya CANCELLED, por lo
      // que un re-PATCH a CANCELLED no repone dos veces. (Nota: reabrir un pedido
      // CANCELLED→PENDING no vuelve a descontar stock; evita ese toggle.)
      if (nextStatus === OrderStatus.CANCELLED && current.status !== OrderStatus.CANCELLED) {
        for (const item of current.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      return tx.order.update({
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
    });

    // Si el pedido pasó a PAID, acreditar los puntos (idempotente, best-effort).
    if (nextStatus === OrderStatus.PAID) {
      await this.loyalty.awardForOrder(id);
    }

    return updated;
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
