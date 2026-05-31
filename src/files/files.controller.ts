import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../users/decorators/auth.decorators';
import { FileService } from './file.service';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly fileService: FileService) { }

  // Subida genérica de imágenes. Pasa por FileService, así que respeta
  // STORAGE_TYPE (local / s3 / gcs) — el archivo se guarda donde toque.
  @Post('upload')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subir una imagen (usa el storage configurado: local/s3/gcs)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    // storeImage valida que sea imagen (400 si no lo es o si falta el archivo)
    const meta = await this.fileService.storeImage(file);
    return { url: meta.url };
  }
}
