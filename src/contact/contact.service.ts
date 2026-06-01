import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContactBlockType, ContactMessageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/database.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { UpdateContactMessageDto } from './dto/update-contact-message.dto';
import { QueryContactMessageDto } from './dto/query-contact-message.dto';
import { CreateContactBlockDto } from './dto/create-contact-block.dto';
import { QueryContactDto } from './dto/query-contact.dto';

// Anti-inundación: ventana deslizante en memoria por IP.
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const RATE_MAX_PER_WINDOW = 5; // máximo de mensajes por IP en la ventana

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  // ip → timestamps de envíos recientes (se purga por ventana en cada chequeo)
  private readonly rateMap = new Map<string, number[]>();

  // Público: recibe un mensaje del formulario aplicando las defensas anti-spam:
  // 1) rate limit por IP, 2) lista negra (email/IP/keyword). Si pasa, lo guarda.
  async createFromPublic(dto: CreateContactMessageDto, ip: string) {
    this.enforceRateLimit(ip);
    await this.assertNotBlocked(dto, ip);

    // Nombre → firstName/lastName (best-effort: corte en el primer espacio).
    const email = dto.email.toLowerCase();
    const trimmedName = dto.name.trim();
    const spaceIdx = trimmedName.indexOf(' ');
    const firstName = spaceIdx === -1 ? trimmedName : trimmedName.slice(0, spaceIdx);
    const lastName = spaceIdx === -1 ? '' : trimmedName.slice(spaceIdx + 1).trim();

    // Vincula (o crea) el Contact por email y enlaza el mensaje con `contactId`.
    return this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        subject: dto.subject,
        message: dto.message,
        ipAddress: ip,
        contact: {
          connectOrCreate: {
            where: { email },
            create: { email, firstName, lastName },
          },
        },
      },
    });
  }

  private enforceRateLimit(ip: string) {
    const now = Date.now();
    const recent = (this.rateMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX_PER_WINDOW) {
      throw new HttpException(
        'Has enviado demasiados mensajes en poco tiempo. Inténtalo de nuevo más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.rateMap.set(ip, recent);
  }

  private async assertNotBlocked(dto: CreateContactMessageDto, ip: string) {
    const blocks = await this.prisma.contactBlock.findMany();
    const email = dto.email.toLowerCase();
    const haystack = `${dto.subject ?? ''} ${dto.message}`.toLowerCase();

    for (const b of blocks) {
      const value = b.value.toLowerCase();
      const hit =
        (b.type === ContactBlockType.EMAIL && email === value) ||
        (b.type === ContactBlockType.IP && ip === b.value) ||
        (b.type === ContactBlockType.KEYWORD && haystack.includes(value));
      if (hit) {
        // Mensaje genérico: no revelamos qué regla bloqueó.
        throw new ForbiddenException('No fue posible enviar tu mensaje.');
      }
    }
  }

  // Admin: bandeja paginada. Sin filtro = todo lo activo (excluye la papelera);
  // con filtro = exactamente ese estado (incluida la papelera con status=TRASHED).
  async findAll({ limit, offset, status }: QueryContactMessageDto) {
    const where: Prisma.ContactMessageWhereInput = status
      ? { status }
      : { status: { not: ContactMessageStatus.TRASHED } };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.contactMessage.count({ where }),
    ]);
    return { data, total, limit, offset };
  }

  // Admin: contadores por estado para los filtros/badges del dashboard
  async getStats() {
    const [active, neew, read, archived, trashed] = await this.prisma.$transaction([
      this.prisma.contactMessage.count({ where: { status: { not: ContactMessageStatus.TRASHED } } }),
      this.prisma.contactMessage.count({ where: { status: ContactMessageStatus.NEW } }),
      this.prisma.contactMessage.count({ where: { status: ContactMessageStatus.READ } }),
      this.prisma.contactMessage.count({ where: { status: ContactMessageStatus.ARCHIVED } }),
      this.prisma.contactMessage.count({ where: { status: ContactMessageStatus.TRASHED } }),
    ]);
    // `total` cuenta los mensajes activos (sin papelera); `unread` es alias de NEW.
    return { total: active, unread: neew, new: neew, read, archived, trashed };
  }

  // Admin: vaciar la papelera (borrado permanente de todos los TRASHED)
  async emptyTrash() {
    const result = await this.prisma.contactMessage.deleteMany({
      where: { status: ContactMessageStatus.TRASHED },
    });
    return { deleted: result.count };
  }

  async findOne(id: string) {
    const message = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!message) throw new NotFoundException(`Mensaje de contacto ${id} no encontrado`);
    return message;
  }

  async updateStatus(id: string, dto: UpdateContactMessageDto) {
    await this.findOne(id);
    return this.prisma.contactMessage.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.contactMessage.delete({ where: { id } });
  }

  // ── Lista negra anti-spam (admin) ──────────────────────────────────────────
  listBlocks(type?: ContactBlockType) {
    return this.prisma.contactBlock.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBlock(dto: CreateContactBlockDto) {
    // Normalizamos email/keyword a minúsculas; la IP se respeta tal cual.
    const value = dto.type === ContactBlockType.IP ? dto.value.trim() : dto.value.trim().toLowerCase();

    const existing = await this.prisma.contactBlock.findUnique({
      where: { type_value: { type: dto.type, value } },
    });
    if (existing) return existing; // idempotente: ya estaba bloqueado

    return this.prisma.contactBlock.create({
      data: { type: dto.type, value, reason: dto.reason },
    });
  }

  async removeBlock(id: string) {
    const block = await this.prisma.contactBlock.findUnique({ where: { id } });
    if (!block) throw new NotFoundException(`Bloqueo ${id} no encontrado`);
    return this.prisma.contactBlock.delete({ where: { id } });
  }

  // ── Admin: directorio de contactos ─────────────────────────────────────────
  // Lista paginada de todos los Contact con su usuario (si lo hay) y la(s)
  // fuente(s) de las que provienen: registro web, compra y/o formulario de
  // contacto. Nunca expone la contraseña del usuario asociado.
  async findAllContacts({ limit, offset, search }: QueryContactDto) {
    const where: Prisma.ContactWhereInput = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, role: true, status: true, password: true },
          },
          _count: { select: { orders: true, messages: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.contact.count({ where }),
    ]);

    const data = rows.map((row) => {
      const orderCount = row._count.orders;
      const messageCount = row._count.messages;

      const sources: string[] = [];
      if (row.user?.password) sources.push('registration');
      if (orderCount > 0) sources.push('purchase');
      if (messageCount > 0) sources.push('contact_form');

      // Reexponemos el usuario SIN la contraseña.
      const user = row.user
        ? {
            id: row.user.id,
            email: row.user.email,
            role: row.user.role,
            status: row.user.status,
          }
        : null;

      return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        userId: row.userId,
        user,
        orderCount,
        messageCount,
        sources,
        createdAt: row.createdAt,
      };
    });

    return { data, total, limit, offset };
  }
}
