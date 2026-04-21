import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponApplicationMode } from '@prisma/client';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { PrismaService } from '../database/database.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly cartInclude = {
    user: true,
    coupon: true,
    couponApplications: {
      include: {
        coupon: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    },
    items: {
      include: {
        product: true,
      },
    },
  } as const;

  private async findOrCreateByUserId(userId: string) {
    const existing = await this.prisma.cart.findUnique({
      where: { userId },
      include: this.cartInclude,
    });

    if (existing) {
      return existing;
    }

    return this.prisma.cart.create({
      data: { userId },
      include: this.cartInclude,
    });
  }

  private async getValidCouponByCode(code: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
      include: {
        couponProducts: true,
      },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with code ${code} not found`);
    }
    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is inactive');
    }
    if (coupon.expiryDate && coupon.expiryDate < new Date()) {
      throw new BadRequestException('Coupon is expired');
    }
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    return coupon;
  }

  private validateCouponProducts(
    allowedProductIds: string[],
    targetProductIds: string[],
  ) {
    if (!allowedProductIds.length) {
      return;
    }
    const allowedSet = new Set(allowedProductIds);
    const invalid = targetProductIds.filter((id) => !allowedSet.has(id));
    if (invalid.length) {
      throw new BadRequestException(
        `Coupon is not valid for products: ${invalid.join(', ')}`,
      );
    }
  }

  create(createCartDto: CreateCartDto) {
    const { userId, productId, quantity, couponId } = createCartDto;

    return this.prisma.cart.create({
      data: {
        userId,
        couponId,
        items: productId
          ? {
              create: {
                productId,
                quantity: quantity ?? 1,
              },
            }
          : undefined,
      },
      include: this.cartInclude,
    });
  }

  async findAll({ limit, offset }: PaginationDto) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.cart.findMany({
        include: this.cartInclude,
        take: limit,
        skip: offset,
      }),
      this.prisma.cart.count(),
    ]);
    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id },
      include: this.cartInclude,
    });

    if (!cart) {
      throw new NotFoundException(`Cart with id ${id} not found`);
    }

    return cart;
  }

  async update(id: string, updateCartDto: UpdateCartDto) {
    await this.findOne(id);

    return this.prisma.cart.update({
      where: { id },
      data: {
        userId: updateCartDto.userId,
        couponId: updateCartDto.couponId,
      },
      include: this.cartInclude,
    });
  }

  async findByUserId(userId: string) {
    return this.findOrCreateByUserId(userId);
  }

  async addProduct(userId: string, productId: string, quantity = 1) {
    const cart = await this.findOrCreateByUserId(userId);
    const safeQuantity = quantity > 0 ? quantity : 1;

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
      },
    });

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + safeQuantity,
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity: safeQuantity,
        },
      });
    }

    return this.findOne(cart.id);
  }

  async updateItemQuantity(userId: string, productId: string, quantity: number) {
    const cart = await this.findOrCreateByUserId(userId);

    if (quantity <= 0) {
      await this.prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          productId,
        },
      });
      return this.findOne(cart.id);
    }

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
      },
    });

    if (!existingItem) {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
        },
      });
      return this.findOne(cart.id);
    }

    await this.prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity },
    });

    return this.findOne(cart.id);
  }

  async removeProduct(userId: string, productId: string) {
    const cart = await this.findOrCreateByUserId(userId);

    await this.prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        productId,
      },
    });

    return this.findOne(cart.id);
  }

  async replaceItems(
    userId: string,
    items: Array<{ productId: string; quantity: number }>,
  ) {
    const cart = await this.findOrCreateByUserId(userId);

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        items: {
          deleteMany: {},
          create: items
            .filter((item) => item.quantity > 0)
            .map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
        },
      },
    });

    return this.findOne(cart.id);
  }

  async clearByUser(userId: string) {
    const cart = await this.findOrCreateByUserId(userId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.findOne(cart.id);
  }

  async applyCouponToCart(userId: string, couponCode: string) {
    const cart = await this.findOrCreateByUserId(userId);
    const coupon = await this.getValidCouponByCode(couponCode);
    const productIds = cart.items.map((item) => item.productId);
    const allowedProductIds = coupon.couponProducts.map((cp) => cp.productId);
    this.validateCouponProducts(allowedProductIds, productIds);

    await this.prisma.cartCouponApplication.create({
      data: {
        cartId: cart.id,
        couponId: coupon.id,
        mode: CouponApplicationMode.CART,
        items: {
          create: productIds.map((productId) => ({ productId })),
        },
      },
    });

    return this.findOne(cart.id);
  }

  async applyCouponToItem(userId: string, productId: string, couponCode: string) {
    const cart = await this.findOrCreateByUserId(userId);
    const hasItem = cart.items.some((item) => item.productId === productId);
    if (!hasItem) {
      throw new NotFoundException(
        `Product ${productId} is not present in user cart`,
      );
    }

    const coupon = await this.getValidCouponByCode(couponCode);
    const allowedProductIds = coupon.couponProducts.map((cp) => cp.productId);
    this.validateCouponProducts(allowedProductIds, [productId]);

    await this.prisma.cartCouponApplication.create({
      data: {
        cartId: cart.id,
        couponId: coupon.id,
        mode: CouponApplicationMode.ITEM,
        items: {
          create: [{ productId }],
        },
      },
    });

    return this.findOne(cart.id);
  }

  async applyCouponToGroup(
    userId: string,
    productIds: string[],
    couponCode: string,
  ) {
    const cart = await this.findOrCreateByUserId(userId);
    const cartProductSet = new Set(cart.items.map((item) => item.productId));
    const missing = productIds.filter((id) => !cartProductSet.has(id));
    if (missing.length) {
      throw new NotFoundException(
        `Products are not present in user cart: ${missing.join(', ')}`,
      );
    }

    const coupon = await this.getValidCouponByCode(couponCode);
    const allowedProductIds = coupon.couponProducts.map((cp) => cp.productId);
    this.validateCouponProducts(allowedProductIds, productIds);

    await this.prisma.cartCouponApplication.create({
      data: {
        cartId: cart.id,
        couponId: coupon.id,
        mode: CouponApplicationMode.GROUP,
        items: {
          create: productIds.map((productId) => ({ productId })),
        },
      },
    });

    return this.findOne(cart.id);
  }

  async removeCouponApplication(userId: string, applicationId: string) {
    const cart = await this.findOrCreateByUserId(userId);
    await this.prisma.cartCouponApplication.deleteMany({
      where: {
        id: applicationId,
        cartId: cart.id,
      },
    });

    return this.findOne(cart.id);
  }

  async clearCouponApplications(userId: string) {
    const cart = await this.findOrCreateByUserId(userId);
    await this.prisma.cartCouponApplication.deleteMany({
      where: { cartId: cart.id },
    });

    return this.findOne(cart.id);
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.cart.delete({
      where: { id },
    });
  }
}
