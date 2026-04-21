import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { PrismaService } from '../database/database.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAddressDto: CreateAddressDto) {
    return this.prisma.address.create({
      data: createAddressDto,
      include: {
        user: true,
      },
    });
  }

  async findAll({ limit, offset }: PaginationDto) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.address.findMany({
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.address.count(),
    ]);
    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    const address = await this.prisma.address.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!address) {
      throw new NotFoundException(`Address with id ${id} not found`);
    }

    return address;
  }

  async update(id: string, updateAddressDto: UpdateAddressDto) {
    await this.findOne(id);

    return this.prisma.address.update({
      where: { id },
      data: updateAddressDto,
      include: {
        user: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.address.delete({
      where: { id },
    });
  }
}
