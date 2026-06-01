import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/database.service';

// Clave bajo la que se guarda el saldo de puntos en `user_settings`.
export const LOYALTY_POINTS_KEY = 'loyalty_points';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Lee el saldo de puntos acumulados de un usuario (0 si no tiene fila).
  async getBalance(userId: string): Promise<number> {
    const row = await this.prisma.userSetting.findUnique({
      where: { userId_metaKey: { userId, metaKey: LOYALTY_POINTS_KEY } },
      select: { metaValue: true },
    });
    if (!row) return 0;
    const n = parseInt(row.metaValue, 10);
    return Number.isFinite(n) ? n : 0;
  }

  // Acredita al saldo del usuario los puntos congelados del pedido. Es:
  //   · IDEMPOTENTE  → el flip de `pointsAwarded` (updateMany con guarda) sólo
  //                    afecta una vez aunque R4 reintente o el admin re-confirme.
  //   · CONDICIONAL  → sólo acredita si el pedido está PAID.
  //   · ATÓMICO      → el UPSERT incrementa con CAST(...AS INTEGER) en SQL, así
  //                    dos pedidos del mismo usuario confirmados a la vez no se
  //                    pisan el saldo aunque `metaValue` sea texto.
  // Todo ocurre dentro de una transacción: si el incremento falla, el flip se
  // revierte y el pedido queda re-acreditable.
  async awardForOrder(orderId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const flip = await tx.order.updateMany({
          where: { id: orderId, status: 'PAID', pointsAwarded: false },
          data: { pointsAwarded: true },
        });
        if (flip.count !== 1) return; // ya acreditado, o el pedido no está PAID

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { userId: true, pointsEarned: true },
        });
        if (!order || order.pointsEarned <= 0) return;

        const id = randomUUID();
        await tx.$executeRaw`
          INSERT INTO user_settings (id, "userId", "metaKey", "metaValue", "createdAt", "updatedAt")
          VALUES (${id}, ${order.userId}, ${LOYALTY_POINTS_KEY}, ${String(order.pointsEarned)}, now(), now())
          ON CONFLICT ("userId", "metaKey")
          DO UPDATE SET
            "metaValue" = (CAST(user_settings."metaValue" AS INTEGER) + ${order.pointsEarned})::text,
            "updatedAt" = now()
        `;
        this.logger.log(`Acreditados ${order.pointsEarned} pts al usuario ${order.userId} (pedido ${orderId})`);
      });
    } catch (error) {
      // No debe romper la confirmación del pago: el dinero ya entró. Se registra
      // para revisión; el pedido queda con pointsAwarded=false y puede reintentarse.
      this.logger.error(
        `No se pudieron acreditar puntos del pedido ${orderId}: ${(error as Error)?.message ?? error}`,
      );
    }
  }
}
