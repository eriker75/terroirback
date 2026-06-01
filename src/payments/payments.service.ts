import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/database.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { QueryPaymentDto } from './dto/query-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loyalty: LoyaltyService,
  ) {}

  // Listado de pagos (admin) con filtro opcional por estado y paginación.
  async findAll({ limit, offset, status, method, bank, search, dateFrom, dateTo }: QueryPaymentDto) {
    const where: Prisma.PaymentWhereInput = {};
    if (status) where.status = status;
    if (method) where.method = method;
    if (bank) where.bank = bank;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
      };
    }
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { payerIdDocument: { contains: search, mode: 'insensitive' } },
        { payerPhone: { contains: search, mode: 'insensitive' } },
        { order: { user: { email: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              status: true,
              total: true,
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, total, limit, offset };
  }

  // Confirmación manual (admin) / punto de entrada para un futuro webhook.
  // Actualiza el estado del pago. Si pasa a COMPLETED, marca confirmedAt y
  // promueve el pedido asociado a PAID.
  async updateStatus(id: string, status: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException(`Pago ${id} no encontrado`);
    }

    // Actualizamos el pago y (si pasa a COMPLETED) promovemos la orden a PAID
    // de forma atómica: o se aplican ambos cambios o ninguno (si la orden no
    // existe / falla la 2da escritura, se revierte el cambio del pago).
    const updated = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.payment.update({
        where: { id },
        data: {
          status,
          ...(status === 'COMPLETED' ? { confirmedAt: new Date() } : {}),
        },
      });

      if (status === 'COMPLETED') {
        // payment.orderId referencia Order.id (uuid).
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID' },
        });
      }

      return upd;
    });

    // Tras confirmar el pago (orden ya PAID), acredita los puntos al cliente.
    // Idempotente y best-effort: no revierte la confirmación si algo falla.
    if (status === 'COMPLETED') {
      await this.loyalty.awardForOrder(payment.orderId);
    }

    return updated;
  }
}
