import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/database.service';
import { FileService } from './file.service';

// Tablas de imágenes soportadas. Agregar aquí una nueva entidad es suficiente
// para reutilizar todo el flujo de subida/borrado.
export type ImageModel = 'productImage' | 'categoryImage';

const OWNER_FIELD: Record<ImageModel, string> = {
  productImage: 'productId',
  categoryImage: 'categoryId',
};

/**
 * Persistencia MODULAR de imágenes por entidad: en lugar de una tabla `media`
 * genérica, se indica el nombre de la tabla destino (`model`) y el flujo
 * (subir archivo → guardar metadatos → listar → borrar) funciona igual para
 * cualquier entidad. El nombre de la tabla viaja como parámetro.
 */
@Injectable()
export class EntityImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  private delegate(model: ImageModel) {
    // Acceso dinámico al modelo de Prisma según el nombre de tabla recibido.
    return (this.prisma as any)[model];
  }

  list(model: ImageModel, ownerId: string) {
    return this.delegate(model).findMany({
      where: { [OWNER_FIELD[model]]: ownerId },
      orderBy: { position: 'asc' },
    });
  }

  /** Sube la imagen al storage y guarda sus metadatos en la tabla indicada. */
  async add(model: ImageModel, ownerId: string, file: Express.Multer.File) {
    const ownerField = OWNER_FIELD[model];
    const meta = await this.fileService.storeImage(file);

    // La nueva imagen se agrega al final de la galería.
    const position = await this.delegate(model).count({ where: { [ownerField]: ownerId } });

    return this.delegate(model).create({
      data: {
        [ownerField]: ownerId,
        url: meta.url,
        pathName: meta.pathName,
        filename: meta.filename,
        mimeType: meta.mimeType,
        size: meta.size,
        position,
      },
    });
  }

  /** Borra el registro y el archivo físico asociado. */
  async remove(model: ImageModel, imageId: string) {
    const image = await this.delegate(model).findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException(`Imagen ${imageId} no encontrada`);

    await this.fileService.removeImage(image.pathName);
    return this.delegate(model).delete({ where: { id: imageId } });
  }
}
