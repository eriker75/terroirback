import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { PrismaService } from '../database/database.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { BulkImportDto } from '../common/dto/bulk-import.dto';
import {
  runBulkImport,
  validateAgainstDto,
  type BulkResult,
} from '../common/bulk/bulk-import.helper';

// Para listados/admin sólo interesa cuántos productos usan la etiqueta,
// no el detalle completo de cada producto: el conteo mantiene el payload liviano.
const TAG_INCLUDE = {
  _count: { select: { productTags: true } },
} satisfies Prisma.TagInclude;

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTagDto: CreateTagDto) {
    try {
      return await this.prisma.tag.create({
        data: createTagDto,
        include: TAG_INCLUDE,
      });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async findAll({ limit, offset }: PaginationDto) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        include: TAG_INCLUDE,
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
      include: TAG_INCLUDE,
    });

    if (!tag) {
      throw new NotFoundException(`Tag with id ${id} not found`);
    }

    return tag;
  }

  async update(id: string, updateTagDto: UpdateTagDto) {
    await this.findOne(id);

    try {
      return await this.prisma.tag.update({
        where: { id },
        data: updateTagDto,
        include: TAG_INCLUDE,
      });
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.tag.delete({
      where: { id },
    });
  }

  // Importación masiva desde CSV. La clave única para resolver duplicados es
  // `name`/`slug` (ambos @unique). Reutiliza la misma validación (CreateTagDto)
  // y la lógica de create/update del recurso.
  async bulkImport({ mode, rows }: BulkImportDto): Promise<BulkResult> {
    return runBulkImport<CreateTagDto>(rows, mode, {
      prepare: (raw) =>
        validateAgainstDto(CreateTagDto, {
          name: raw.name,
          slug: raw.slug,
        }),
      findExisting: (row) =>
        this.prisma.tag.findFirst({
          where: { OR: [{ name: row.name }, { slug: row.slug }] },
        }),
      create: (row) => this.create(row),
      update: (existing, row) =>
        this.update((existing as { id: string }).id, row),
    });
  }

  // Traduce la violación de índice único (P2002 de Prisma) en un 409 legible
  // para el cliente. `name` y `slug` son únicos en el modelo Tag.
  private handleUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ya existe una etiqueta con ese nombre o slug',
      );
    }
    throw error;
  }
}
