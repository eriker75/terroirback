import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto, StockOperation } from './dto/adjust-stock.dto';
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

    console.log('[create product] categoryId recibido:', JSON.stringify(categoryId), '| tipo:', typeof categoryId);

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

    // `stock` se ignora aquí a propósito: en productos existentes solo se modifica
    // mediante adjustStock() (operación atómica add/subtract) para evitar pisar
    // cambios concurrentes. Ver PATCH /products/:id/stock.
    const { tagIds, attributes, categoryId, relatedProducts, stock: _stock, ...productData } =
      updateProductDto;

    return this.prisma.product.update({
      where: { id },
      data: {
        ...productData,
        ...(categoryId === undefined
          ? {}
          : categoryId
            ? { category: { connect: { id: categoryId } } }
            : { category: { disconnect: true } }),
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

  // Ajuste relativo y atómico del stock. No lee-y-pisa: usa increment/decrement
  // a nivel de base de datos, por lo que es seguro ante operaciones concurrentes
  // (p. ej. una compra que descuenta stock al mismo tiempo).
  async adjustStock(id: string, { operation, quantity }: AdjustStockDto) {
    if (operation === StockOperation.ADD) {
      try {
        return await this.prisma.product.update({
          where: { id },
          data: { stock: { increment: quantity } },
          include: this.productInclude,
        });
      } catch {
        throw new NotFoundException(`Product with id ${id} not found`);
      }
    }

    // SUBTRACT — solo descuenta si hay stock suficiente. La condición `stock >= quantity`
    // viaja en el WHERE, así que la verificación y la resta son una sola operación atómica.
    const result = await this.prisma.product.updateMany({
      where: { id, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });

    if (result.count === 0) {
      // O el producto no existe, o no hay stock suficiente. Distinguimos ambos casos.
      const product = await this.prisma.product.findUnique({
        where: { id },
        select: { stock: true },
      });
      if (!product) {
        throw new NotFoundException(`Product with id ${id} not found`);
      }
      throw new BadRequestException(
        `Stock insuficiente: hay ${product.stock} unidades y se intentan restar ${quantity}`,
      );
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.delete({ where: { id } });
  }
}
