import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Auth } from '../users/decorators/auth.decorators';
import { ValidRoles } from '../users/interfaces';
import { PaginationDto } from '../common/dto/pagination.dto';
import { EntityImagesService } from '../files/entity-images.service';

const imageUpload = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
};

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly imagesService: EntityImagesService,
  ) {}

  // Admin: crear categoría
  @Post()
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Crear una nueva categoría' })
  @ApiResponse({ status: 201, description: 'Categoría creada correctamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  // Público: listar categorías
  @Get()
  @ApiOperation({ summary: 'Obtener todas las categorías' })
  @ApiResponse({ status: 200, description: 'Lista de categorías.' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.categoryService.findAll(paginationDto);
  }

  // Público: ver categoría
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una categoría por ID' })
  @ApiParam({ name: 'id', description: 'ID de la categoría (cuid)' })
  @ApiResponse({ status: 200, description: 'Categoría encontrada.' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' })
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  // ── Imágenes de la categoría (tabla category_images) ───────────────────────

  // Público: galería de imágenes de la categoría
  @Get(':id/images')
  @ApiOperation({ summary: 'Listar imágenes de una categoría' })
  @ApiParam({ name: 'id', description: 'ID de la categoría (uuid)' })
  listImages(@Param('id') id: string) {
    return this.imagesService.list('categoryImage', id);
  }

  // Admin: subir una imagen a la galería de la categoría
  @Post(':id/images')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[Admin] Subir una imagen a la categoría' })
  @ApiParam({ name: 'id', description: 'ID de la categoría (uuid)' })
  @ApiResponse({ status: 201, description: 'Imagen subida.' })
  @UseInterceptors(FileInterceptor('file', imageUpload))
  uploadImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.imagesService.add('categoryImage', id, file);
  }

  // Admin: eliminar una imagen de la galería
  @Delete('images/:imageId')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Eliminar una imagen de la categoría' })
  @ApiParam({ name: 'imageId', description: 'ID de la imagen (uuid)' })
  removeImage(@Param('imageId') imageId: string) {
    return this.imagesService.remove('categoryImage', imageId);
  }

  // Admin: editar categoría
  @Patch(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Actualizar una categoría' })
  @ApiParam({ name: 'id', description: 'ID de la categoría (cuid)' })
  @ApiResponse({ status: 200, description: 'Categoría actualizada.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' })
  update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  // Admin: eliminar categoría
  @Delete(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Eliminar una categoría' })
  @ApiParam({ name: 'id', description: 'ID de la categoría (cuid)' })
  @ApiResponse({ status: 200, description: 'Categoría eliminada.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' })
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
