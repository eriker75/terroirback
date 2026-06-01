import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/database.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Confirmación manual (admin) / punto de entrada para un futuro webhook.
  // Actualiza el estado del pago. Si pasa a COMPLETED, marca confirmedAt y
  // promueve el pedido asociado a PAID.
  async updateStatus(id: string, status: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException(`Pago ${id} no encontrado`);
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status,
        ...(status === 'COMPLETED' ? { confirmedAt: new Date() } : {}),
      },
    });

    if (status === 'COMPLETED') {
      // payment.orderId referencia Order.id (uuid).
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'PAID' },
      });
    }

    return updated;
  }
}
