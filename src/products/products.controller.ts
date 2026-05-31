import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { Auth } from '../users/decorators/auth.decorators';
import { ValidRoles } from '../users/interfaces';
import { PaginationDto } from '../common/dto/pagination.dto';
import { EntityImagesService } from '../files/entity-images.service';

// Imágenes en memoria (buffer) para que el FileService decida dónde persistirlas
const imageUpload = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
};

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly imagesService: EntityImagesService,
  ) { }

  // Admin: crear producto
  @Post()
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Crear un nuevo producto' })
  @ApiResponse({ status: 201, description: 'Producto creado correctamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  // Público: catálogo de productos
  @Get()
  @ApiOperation({ summary: 'Obtener todos los productos' })
  @ApiResponse({ status: 200, description: 'Lista de productos.' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.productsService.findAll(paginationDto);
  }

  // Público: detalle de producto
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un producto por ID' })
  @ApiParam({ name: 'id', description: 'ID del producto (cuid)' })
  @ApiResponse({ status: 200, description: 'Producto encontrado.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // Admin: ajustar stock de forma relativa y atómica (sumar/restar)
  @Patch(':id/stock')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Sumar o restar unidades al stock (atómico)' })
  @ApiParam({ name: 'id', description: 'ID del producto (uuid)' })
  @ApiResponse({ status: 200, description: 'Stock ajustado.' })
  @ApiResponse({ status: 400, description: 'Stock insuficiente para restar.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  adjustStock(@Param('id') id: string, @Body() adjustStockDto: AdjustStockDto) {
    return this.productsService.adjustStock(id, adjustStockDto);
  }

  // ── Imágenes del producto (tabla product_images) ───────────────────────────

  // Público: galería de imágenes del producto
  @Get(':id/images')
  @ApiOperation({ summary: 'Listar imágenes de un producto' })
  @ApiParam({ name: 'id', description: 'ID del producto (uuid)' })
  listImages(@Param('id') id: string) {
    return this.imagesService.list('productImage', id);
  }

  // Admin: subir una imagen a la galería del producto
  @Post(':id/images')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[Admin] Subir una imagen al producto' })
  @ApiParam({ name: 'id', description: 'ID del producto (uuid)' })
  @ApiResponse({ status: 201, description: 'Imagen subida.' })
  @UseInterceptors(FileInterceptor('file', imageUpload))
  uploadImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.imagesService.add('productImage', id, file);
  }

  // Admin: eliminar una imagen de la galería
  @Delete('images/:imageId')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Eliminar una imagen del producto' })
  @ApiParam({ name: 'imageId', description: 'ID de la imagen (uuid)' })
  removeImage(@Param('imageId') imageId: string) {
    return this.imagesService.remove('productImage', imageId);
  }

  // Admin: editar producto
  @Patch(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Actualizar un producto' })
  @ApiParam({ name: 'id', description: 'ID del producto (cuid)' })
  @ApiResponse({ status: 200, description: 'Producto actualizado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  // Admin: eliminar producto
  @Delete(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Eliminar un producto' })
  @ApiParam({ name: 'id', description: 'ID del producto (cuid)' })
  @ApiResponse({ status: 200, description: 'Producto eliminado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
