import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../database/database.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly productInclude = {
    category: true,
    attributes: true,
    productTags: {
      include: { tag: true },
    },
    relatedProducts: {
      include: {
        related: {
          select: {
            id: true,
            name: true,
            price: true,
            mainImage: true,
          },
        },
      },
    },
  } satisfies Prisma.ProductInclude;

  create(createProductDto: CreateProductDto) {
    const { tagIds, attributes, categoryId, relatedProducts, ...productData } =
      createProductDto;

    return this.prisma.product.create({
      data: {
        ...productData,
        images: productData.images ?? [],
        ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
        productTags: tagIds?.length
          ? { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) }
          : undefined,
        attributes: attributes?.length
          ? { create: attributes }
          : undefined,
        relatedProducts: relatedProducts?.length
          ? { create: relatedProducts.map(({ relatedId, relationType }) => ({ relatedId, relationType })) }
          : undefined,
      },
      include: this.productInclude,
    });
  }

  async findAll({ limit, offset }: PaginationDto) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        include: this.productInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.product.count(),
    ]);
    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: this.productInclude,
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);

    const { tagIds, attributes, categoryId, relatedProducts, ...productData } =
      updateProductDto;

    return this.prisma.product.update({
      where: { id },
      data: {
        ...productData,
        ...(categoryId !== undefined
          ? { category: { connect: { id: categoryId } } }
          : {}),
        productTags: tagIds
          ? {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
            }
          : undefined,
        attributes: attributes
          ? { deleteMany: {}, create: attributes }
          : undefined,
        relatedProducts: relatedProducts
          ? {
              deleteMany: {},
              create: relatedProducts.map(({ relatedId, relationType }) => ({
                relatedId,
                relationType,
              })),
            }
          : undefined,
      },
      include: this.productInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.delete({ where: { id } });
  }
}
