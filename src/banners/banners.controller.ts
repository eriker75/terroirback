import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { Auth } from '../users/decorators/auth.decorators';
import { ValidRoles } from '../users/interfaces';

@ApiTags('banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  // Admin: crear banner
  @Post()
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Crear un nuevo banner' })
  @ApiResponse({ status: 201, description: 'Banner creado correctamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  create(@Body() createBannerDto: CreateBannerDto) {
    return this.bannersService.create(createBannerDto);
  }

  // Público: ver banners del storefront
  @Get()
  @ApiOperation({ summary: 'Obtener todos los banners' })
  @ApiResponse({ status: 200, description: 'Lista de banners.' })
  findAll() {
    return this.bannersService.findAll();
  }

  // Público: ver banner
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un banner por ID' })
  @ApiParam({ name: 'id', description: 'ID del banner (cuid)' })
  @ApiResponse({ status: 200, description: 'Banner encontrado.' })
  @ApiResponse({ status: 404, description: 'Banner no encontrado.' })
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  // Admin: editar banner
  @Patch(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Actualizar un banner' })
  @ApiParam({ name: 'id', description: 'ID del banner (cuid)' })
  @ApiResponse({ status: 200, description: 'Banner actualizado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  @ApiResponse({ status: 404, description: 'Banner no encontrado.' })
  update(@Param('id') id: string, @Body() updateBannerDto: UpdateBannerDto) {
    return this.bannersService.update(id, updateBannerDto);
  }

  // Admin: eliminar banner
  @Delete(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Eliminar un banner' })
  @ApiParam({ name: 'id', description: 'ID del banner (cuid)' })
  @ApiResponse({ status: 200, description: 'Banner eliminado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  @ApiResponse({ status: 404, description: 'Banner no encontrado.' })
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
