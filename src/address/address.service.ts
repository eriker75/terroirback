import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { PrismaService } from '../database/database.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { buildOrderBy } from '../common/sort/build-order-by';

// Columnas ordenables desde la tabla de direcciones del admin (cabeceras clickeables).
const ADDRESS_SORT_COLUMNS: Record<
  string,
  (dir: Prisma.SortOrder) => Prisma.AddressOrderByWithRelationInput
> = {
  recipient: (dir) => ({ recipientName: dir }),
  line1: (dir) => ({ line1: dir }),
  city: (dir) => ({ city: dir }),
  country: (dir) => ({ country: dir }),
  user: (dir) => ({ user: { firstName: dir } }),
  label: (dir) => ({ label: dir }),
  isDefault: (dir) => ({ isDefault: dir }),
  createdAt: (dir) => ({ createdAt: dir }),
};

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

  // Admin: todas las direcciones con su usuario propietario (campos públicos:
  // sin password ni datos sensibles). Para la vista "Direcciones" del dashboard.
  async findAllForAdmin({ limit, offset, sortBy, order }: PaginationDto) {
    const orderBy = buildOrderBy(sortBy, order, ADDRESS_SORT_COLUMNS, {
      createdAt: 'desc',
    });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.address.findMany({
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy,
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
