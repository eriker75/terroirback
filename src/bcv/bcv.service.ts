import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/database.service';
import { PaginationDto } from '../common/dto/pagination.dto';

// Tasa por defecto si todavía no hay ninguna fila en bcv_rates.
const DEFAULT_RATE = 40;

// Endpoint público gratuito de tasas (USD base). Leemos rates.VES.
const EXCHANGE_RATE_URL = 'https://open.er-api.com/v6/latest/USD';

@Injectable()
export class BcvService {
  private readonly logger = new Logger(BcvService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Tasa vigente = última fila insertada. null si todavía no hay ninguna.
  async getCurrentRate(): Promise<{ rate: number; source: string; updatedAt: Date } | null> {
    try {
      const latest = await this.prisma.bcvRate.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      if (!latest) return null;
      return {
        rate: Number(latest.rate),
        source: latest.source,
        updatedAt: latest.createdAt,
      };
    } catch (error) {
      // p.ej. la tabla `bcv_rates` aún no existe (migración pendiente). No debe
      // romper el checkout ni el GET público: caemos a "sin tasa" (→ default).
      this.logger.warn(
        `No se pudo leer la tasa BCV (¿migración pendiente?): ${(error as Error)?.message ?? error}`,
      );
      return null;
    }
  }

  // Valor numérico de la tasa para el checkout. Si no hay ninguna, cae a un
  // valor por defecto sensato (y deja un warning en logs).
  async getRateValue(): Promise<number> {
    const current = await this.getCurrentRate();
    if (current) return current.rate;
    this.logger.warn(
      `No hay tasa BCV registrada; usando valor por defecto ${DEFAULT_RATE}`,
    );
    return DEFAULT_RATE;
  }

  // Refresca la tasa desde el proveedor externo. Si la respuesta es válida
  // (VES > 0) inserta una fila EXCHANGERATE_API y la devuelve. Si falla, cae a
  // la tasa almacenada (sin insertar) y la devuelve marcada como STORED.
  async refresh(): Promise<{ rate: number; source: string }> {
    try {
      const res = await fetch(EXCHANGE_RATE_URL, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      const ves = Number(data?.rates?.VES);

      if (Number.isFinite(ves) && ves > 0) {
        const created = await this.prisma.bcvRate.create({
          data: {
            rate: new Prisma.Decimal(ves),
            source: 'EXCHANGERATE_API',
          },
        });
        return { rate: Number(created.rate), source: created.source };
      }

      this.logger.warn('Respuesta de tasa inválida (rates.VES ausente o <= 0)');
    } catch (error) {
      this.logger.error(
        `Fallo al refrescar la tasa BCV: ${(error as Error)?.message ?? error}`,
      );
    }

    // Fallback: tasa almacenada (no se inserta nada).
    const rate = await this.getRateValue();
    return { rate, source: 'STORED' };
  }

  // Establece una tasa manual (admin). Inserta una fila MANUAL.
  async setManual(rate: number, note?: string) {
    const created = await this.prisma.bcvRate.create({
      data: {
        rate: new Prisma.Decimal(rate),
        source: 'MANUAL',
        note: note ?? null,
      },
    });
    return { rate: Number(created.rate), source: created.source, note: created.note };
  }

  // Historial paginado, del más reciente al más antiguo.
  async getHistory({ limit, offset }: PaginationDto) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bcvRate.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.bcvRate.count(),
    ]);
    const data = rows.map((r) => ({
      id: r.id,
      rate: Number(r.rate),
      source: r.source,
      note: r.note,
      createdAt: r.createdAt,
    }));
    return { data, total, limit, offset };
  }
}
