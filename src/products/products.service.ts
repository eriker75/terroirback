import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly productInclude = {
    category: true,
    attributes: true,
    productTags: {
      include: {
        tag: true,
      },
    },
  } satisfies Prisma.ProductInclude;

  create(createProductDto: CreateProductDto) {
    const { tagIds, attributes, ...productData } = createProductDto;

    return this.prisma.product.create({
      data: {
        ...productData,
        images: productData.images ?? [],
        productTags: tagIds?.length
          ? {
              create: tagIds.map((tagId) => ({
                tag: { connect: { id: tagId } },
              })),
            }
          : undefined,
        attributes: attributes?.length
          ? {
              create: attributes,
            }
          : undefined,
      },
      include: this.productInclude,
    });
  }

  findAll() {
    return this.prisma.product.findMany({
      include: this.productInclude,
      orderBy: { createdAt: 'desc' },
    });
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

    const { tagIds, attributes, ...productData } = updateProductDto;

    return this.prisma.product.update({
      where: { id },
      data: {
        ...productData,
        productTags: tagIds
          ? {
              deleteMany: {},
              create: tagIds.map((tagId) => ({
                tag: { connect: { id: tagId } },
              })),
            }
          : undefined,
        attributes: attributes
          ? {
              deleteMany: {},
              create: attributes,
            }
          : undefined,
      },
      include: this.productInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.delete({
      where: { id },
    });
  }
}
