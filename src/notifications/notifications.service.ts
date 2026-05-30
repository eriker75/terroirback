import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { PrismaService } from '../database/database.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

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
}
