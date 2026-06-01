import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/database.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { R4WebhookNotificaDto } from './dto/r4-webhook-notifica.dto';
import { R4WebhookConsultaDto } from './dto/r4-webhook-consulta.dto';

// Tolerancia al comparar el monto del abono (Bs) contra el esperado del pago.
const AMOUNT_TOLERANCE = 0.02; // 2%

@Injectable()
export class R4WebhooksService {
  private readonly logger = new Logger(R4WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly loyalty: LoyaltyService,
  ) {}

  // Validación BLOQUEANTE del token: R4 es un llamador servidor-a-servidor que se
  // autentica con un secreto compartido. Una petición sin token válido se rechaza
  // (401), de modo que un POST forjado NO pueda confirmar órdenes sin pago real.
  private validateToken(authToken?: string): void {
    const expected = this.config.get<string>('R4_WEBHOOK_TOKEN');
    if (!expected) {
      this.logger.error('R4_WEBHOOK_TOKEN no configurado: se rechaza el webhook R4');
      throw new UnauthorizedException('Webhook no configurado');
    }
    if (!authToken || authToken !== expected) {
      this.logger.error('Token de webhook R4 inválido o ausente');
      throw new UnauthorizedException('Token de webhook inválido');
    }
  }

  // Normaliza un código de banco a 4 dígitos. null si no hay dígitos.
  private normalizeBank(code?: string): string | null {
    const digits = (code ?? '').replace(/\D/g, '');
    return digits ? digits.padStart(4, '0') : null;
  }

  // Parsea el monto (Bs) tolerando coma decimal / separador de miles (locale VE).
  // Devuelve un número > 0, o null si no es parseable.
  private parseMonto(raw?: string | number): number | null {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (!s) return null;
    if (s.includes(',')) {
      // "1.234,56" -> "1234.56" ; "12,50" -> "12.50"
      s = s.replace(/\./g, '').replace(',', '.');
    }
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Notificación de abono. Empareja contra `payments` por referencia y confirma de
  // forma ATÓMICA e IDEMPOTENTE (a prueba de reintentos/concurrencia de R4).
  async handleNotifica(
    body: R4WebhookNotificaDto,
    authToken?: string,
  ): Promise<{ abono: boolean }> {
    this.validateToken(authToken); // bloqueante: lanza 401 si el token no es válido

    if (!body?.CodigoRed || !body?.Referencia || !body?.TelefonoEmisor || !body?.Monto) {
      return { abono: false };
    }
    if (body.CodigoRed !== '00') {
      return { abono: false };
    }

    const monto = this.parseMonto(body.Monto);
    if (monto == null) {
      this.logger.error(
        `Monto inválido en webhook R4 (Referencia=${body.Referencia}, Monto=${body.Monto}); requiere revisión manual`,
      );
      return { abono: true };
    }

    try {
      const payment = await this.prisma.payment.findFirst({
        where: { reference: body.Referencia },
        orderBy: { createdAt: 'desc' },
        select: { id: true, orderId: true, status: true, amountVes: true },
      });

      if (!payment) {
        this.logger.warn(
          `Abono R4 sin pago coincidente (Referencia=${body.Referencia}, Monto=${monto})`,
        );
        return { abono: true };
      }

      if (payment.status === 'COMPLETED') {
        return { abono: true }; // idempotente: ya confirmado
      }

      // Defensa adicional: el cliente paga el monto en Bs mostrado en el checkout
      // (payment.amountVes). Si difiere demasiado, NO confirmamos automáticamente.
      if (payment.amountVes != null) {
        const expected = Number(payment.amountVes);
        if (expected > 0 && Math.abs(monto - expected) / expected > AMOUNT_TOLERANCE) {
          this.logger.warn(
            `Monto del abono R4 no coincide (esperado≈${expected}, recibido=${monto}, Referencia=${body.Referencia}); requiere revisión manual`,
          );
          return { abono: true };
        }
      }

      // Confirmación atómica e idempotente: el updateMany sólo afecta filas que
      // siguen PENDING/PROCESSING; si count===1 promovemos la orden a PAID.
      const confirmed = await this.prisma.$transaction(async (tx) => {
        const upd = await tx.payment.updateMany({
          where: { id: payment.id, status: { in: ['PENDING', 'PROCESSING'] } },
          data: {
            status: 'COMPLETED',
            confirmedAt: new Date(),
            bank: this.normalizeBank(body.BancoEmisor),
            payerPhone: body.TelefonoEmisor,
            amountVes: new Prisma.Decimal(monto),
            rawWebhook: body as Prisma.InputJsonValue,
          },
        });
        if (upd.count === 1) {
          await tx.order.update({ where: { id: payment.orderId }, data: { status: 'PAID' } });
          return true;
        }
        return false;
      });

      if (confirmed) {
        this.logger.log(`Abono R4 confirmado (Referencia=${body.Referencia}) → orden PAID`);
        // Acredita los puntos al cliente (idempotente, best-effort).
        await this.loyalty.awardForOrder(payment.orderId);
      }
      return { abono: true };
    } catch (error) {
      // Error interno: el dinero ya entró → confirmamos para que R4 no lo reverse.
      this.logger.error(
        `Error procesando notificación R4 (Referencia=${body.Referencia}): ${(error as Error)?.message ?? error}`,
      );
      return { abono: true };
    }
  }

  // Consulta de R4: validación bloqueante; confirmamos disponibilidad.
  async handleConsulta(
    _body: R4WebhookConsultaDto,
    authToken?: string,
  ): Promise<{ status: boolean }> {
    this.validateToken(authToken);
    return { status: true };
  }
}
