import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto, StockOperation } from './dto/adjust-stock.dto';
import { FilterProductsDto, ProductSort } from './dto/filter-products.dto';
import { PrismaService } from '../database/database.service';
import { canAccessVisibility } from '../common/account.constants';

// Quién consulta el catálogo. null = invitado. El admin (role) ve todo; un B2B
// (accountType) ve además los WHOLESALE_ONLY. Lo pasa el controller desde el token.
export type ProductViewer = { role?: string; accountType?: string } | null;

// Nombres de atributo que se consideran "tueste"/"origen". El catálogo guarda
// estas características como ProductAttribute libres (name/value), así que el
// filtro acepta varias convenciones de nombre para ser tolerante con los datos.
const ROAST_ATTR_NAMES = ['roast', 'tueste', 'tostado'];
const ORIGIN_ATTR_NAMES = ['origin', 'origen', 'procedencia'];

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) { }

  private readonly productInclude = {
    category: true,
    attributes: true,
    variants: true,
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
    const { tagIds, attributes, variants, categoryId, relatedProducts, ...productData } =
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
        variants: variants?.length
          ? { create: variants }
          : undefined,
        relatedProducts: relatedProducts?.length
          ? { create: relatedProducts.map(({ relatedId, relationType }) => ({ relatedId, relationType })) }
          : undefined,
      },
      include: this.productInclude,
    });
  }

  async findAll(filters: FilterProductsDto, viewer?: ProductViewer) {
    const { limit, offset } = filters;
    const where = this.buildWhere(filters, viewer);
    const orderBy = this.buildOrderBy(filters.sort);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: this.productInclude,
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, total, limit, offset };
  }

  // Traduce los filtros del catálogo a un WHERE de Prisma. Cada criterio se
  // acumula en un AND para que se combinen sin pisarse entre sí (p. ej. tueste
  // y origen, que ambos consultan la relación `attributes`).
  private buildWhere(filters: FilterProductsDto, viewer?: ProductViewer): Prisma.ProductWhereInput {
    const AND: Prisma.ProductWhereInput[] = [];

    // Visibilidad por segmento (no aplica al admin, que ve todo). Se omite cuando
    // viewer es undefined (llamadas internas de confianza).
    const visibility = this.visibilityWhere(viewer);
    if (visibility) AND.push(visibility);

    if (filters.q) {
      AND.push({
        OR: [
          { name: { contains: filters.q, mode: 'insensitive' } },
          { description: { contains: filters.q, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.categoryId) {
      AND.push({ categoryId: filters.categoryId });
    }

    const price = this.range(filters.minPrice, filters.maxPrice);
    if (price) AND.push({ price });

    const points = this.range(filters.minPoints, filters.maxPoints);
    if (points) AND.push({ pointsPrice: points });

    if (filters.inStock) {
      AND.push({ stock: { gt: 0 } });
    }

    if (filters.roast) {
      AND.push({
        attributes: {
          some: {
            name: { in: ROAST_ATTR_NAMES, mode: 'insensitive' },
            value: { equals: filters.roast, mode: 'insensitive' },
          },
        },
      });
    }

    if (filters.origin) {
      AND.push({
        attributes: {
          some: {
            name: { in: ORIGIN_ATTR_NAMES, mode: 'insensitive' },
            value: { equals: filters.origin, mode: 'insensitive' },
          },
        },
      });
    }

    if (filters.tag) {
      AND.push({ productTags: { some: { tag: { slug: filters.tag } } } });
    }

    return AND.length ? { AND } : {};
  }

  // Construye un filtro de rango numérico solo con los extremos definidos.
  // Devuelve undefined si no hay ningún límite, para no añadir un WHERE vacío.
  private range(min?: number, max?: number) {
    if (min === undefined && max === undefined) return undefined;
    return {
      ...(min !== undefined ? { gte: min } : {}),
      ...(max !== undefined ? { lte: max } : {}),
    };
  }

  private buildOrderBy(
    sort?: ProductSort,
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case ProductSort.PRICE_ASC:
        return { price: 'asc' };
      case ProductSort.PRICE_DESC:
        return { price: 'desc' };
      case ProductSort.NAME_ASC:
        return { name: 'asc' };
      case ProductSort.NAME_DESC:
        return { name: 'desc' };
      case ProductSort.OLDEST:
        return { createdAt: 'asc' };
      case ProductSort.NEWEST:
      case ProductSort.FEATURED:
      default:
        return { createdAt: 'desc' };
    }
  }

  // Predicado de visibilidad para el catálogo según el visor.
  //   · undefined          → llamada interna de confianza (sin filtro).
  //   · role === 'admin'   → ve todo (sin filtro).
  //   · accountType B2B    → ve todo (los productos B2C son públicos) → sin filtro.
  //   · resto (B2C/invitado) → todo MENOS los WHOLESALE_ONLY.
  private visibilityWhere(viewer?: ProductViewer): Prisma.ProductWhereInput | null {
    if (viewer === undefined) return null;
    if (viewer?.role === 'admin') return null;
    if (viewer?.accountType === 'B2B') return null;
    return { visibility: { not: 'WHOLESALE_ONLY' } };
  }

  async findOne(id: string, viewer?: ProductViewer) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: this.productInclude,
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    // Un producto no visible para el visor se trata como inexistente (404), para
    // no filtrar productos exclusivos por id directo. El admin (viewer.role) y las
    // llamadas internas (viewer undefined) lo omiten.
    if (
      viewer !== undefined &&
      viewer?.role !== 'admin' &&
      !canAccessVisibility(viewer?.accountType, product.visibility)
    ) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);

    // `stock` se ignora aquí a propósito: en productos existentes solo se modifica
    // mediante adjustStock() (operación atómica add/subtract) para evitar pisar
    // cambios concurrentes. Ver PATCH /products/:id/stock.
    const { tagIds, attributes, variants, categoryId, relatedProducts, stock: _stock, ...productData } =
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
        variants: variants
          ? { deleteMany: {}, create: variants }
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
