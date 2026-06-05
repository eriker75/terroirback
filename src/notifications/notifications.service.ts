import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { PrismaService } from '../database/database.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { BulkImportDto } from '../common/dto/bulk-import.dto';
import {
  runBulkImport,
  validateAgainstDto,
  type BulkResult,
} from '../common/bulk/bulk-import.helper';
import { compactRow } from '../common/bulk/compact-row';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        title: dto.title,
        message: dto.message,
        audience: dto.audience,
        status: dto.status,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
    });
  }

  async findAll({ limit, offset }: PaginationDto) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count(),
    ]);
    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    return notification;
  }

  async update(id: string, dto: UpdateNotificationDto) {
    await this.findOne(id);
    return this.prisma.notification.update({
      where: { id },
      data: {
        title: dto.title,
        message: dto.message,
        audience: dto.audience,
        status: dto.status,
        scheduledAt: dto.scheduledAt !== undefined
          ? (dto.scheduledAt ? new Date(dto.scheduledAt) : null)
          : undefined,
      },
    });
  }

  async sendNow(id: string) {
    await this.findOne(id);
    return this.prisma.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.notification.delete({ where: { id } });
  }

  // Importación masiva desde CSV. Sin clave única natural: se resuelve duplicado
  // por `id` (si viene en el archivo) o por `title`.
  async bulkImport({ mode, rows }: BulkImportDto): Promise<BulkResult> {
    type NotificationRow = { dto: CreateNotificationDto; id?: string };

    return runBulkImport<NotificationRow>(rows, mode, {
      prepare: async (raw) => {
        const dto = await validateAgainstDto(
          CreateNotificationDto,
          compactRow({
            title: raw.title,
            message: raw.message,
            audience: raw.audience,
            status: raw.status,
            scheduledAt: raw.scheduledAt,
          }) as Record<string, unknown>,
        );
        const id =
          typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : undefined;
        return { dto, id };
      },
      findExisting: ({ dto, id }) =>
        id
          ? this.prisma.notification.findUnique({ where: { id } })
          : this.prisma.notification.findFirst({ where: { title: dto.title } }),
      create: ({ dto }) => this.create(dto),
      update: (existing, { dto }) =>
        this.update((existing as { id: string }).id, dto),
    });
  }
}
