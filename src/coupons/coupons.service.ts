import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly couponInclude = {
    couponProducts: {
      include: {
        product: true,
      },
    },
  } as const;

  create(createCouponDto: CreateCouponDto) {
    const { allowedProductIds, expiryDate, ...couponData } = createCouponDto;

    return this.prisma.coupon.create({
      data: {
        ...couponData,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        couponProducts: allowedProductIds?.length
          ? {
              create: allowedProductIds.map((productId) => ({
                productId,
              })),
            }
          : undefined,
      },
      include: this.couponInclude,
    });
  }

  findAll() {
    return this.prisma.coupon.findMany({
      include: this.couponInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: this.couponInclude,
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with id ${id} not found`);
    }

    return coupon;
  }

  async update(id: string, updateCouponDto: UpdateCouponDto) {
    await this.findOne(id);

    const { allowedProductIds, expiryDate, ...couponData } = updateCouponDto;
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...couponData,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        couponProducts: allowedProductIds
          ? {
              deleteMany: {},
              create: allowedProductIds.map((productId) => ({ productId })),
            }
          : undefined,
      },
      include: this.couponInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.coupon.delete({
      where: { id },
    });
  }
}
