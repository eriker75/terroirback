import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createTagDto: CreateTagDto) {
    return this.prisma.tag.create({
      data: createTagDto,
      include: {
        productTags: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async findAll({ limit, offset }: PaginationDto) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        include: { productTags: { include: { product: true } } },
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.tag.count(),
    ]);
    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        productTags: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException(`Tag with id ${id} not found`);
    }

    return tag;
  }

  async update(id: string, updateTagDto: UpdateTagDto) {
    await this.findOne(id);

    return this.prisma.tag.update({
      where: { id },
      data: updateTagDto,
      include: {
        productTags: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.tag.delete({
      where: { id },
    });
  }
}
