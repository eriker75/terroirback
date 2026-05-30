import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../users/decorators/auth.decorators';

const storage = diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    const unique = randomBytes(16).toString('hex');
    cb(null, `${unique}${extname(file.originalname)}`);
  },
});

@ApiTags('files')
@Controller('files')
export class FilesController {
  @Post('upload')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subir un archivo de imagen' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Solo se permiten imágenes'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');

    const baseUrl = process.env.BACKEND_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    return { url: `${baseUrl}/uploads/${file.filename}` };
  }
}
