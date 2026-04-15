import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { Auth } from '../users/decorators/auth.decorators';
import { ValidRoles } from '../users/interfaces';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // Admin: crear cupón
  @Post()
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Crear un nuevo cupón de descuento' })
  @ApiResponse({ status: 201, description: 'Cupón creado correctamente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.create(createCouponDto);
  }

  // Autenticado: ver cupones disponibles
  @Get()
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todos los cupones' })
  @ApiResponse({ status: 200, description: 'Lista de cupones.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.couponsService.findAll(paginationDto);
  }

  // Autenticado: ver un cupón específico
  @Get(':id')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener un cupón por ID' })
  @ApiParam({ name: 'id', description: 'ID del cupón (cuid)' })
  @ApiResponse({ status: 200, description: 'Cupón encontrado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado.' })
  findOne(@Param('id') id: string) {
    return this.couponsService.findOne(id);
  }

  // Admin: editar cupón
  @Patch(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Actualizar un cupón' })
  @ApiParam({ name: 'id', description: 'ID del cupón (cuid)' })
  @ApiResponse({ status: 200, description: 'Cupón actualizado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado.' })
  update(@Param('id') id: string, @Body() updateCouponDto: UpdateCouponDto) {
    return this.couponsService.update(id, updateCouponDto);
  }

  // Admin: eliminar cupón
  @Delete(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Eliminar un cupón' })
  @ApiParam({ name: 'id', description: 'ID del cupón (cuid)' })
  @ApiResponse({ status: 200, description: 'Cupón eliminado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado.' })
  remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}
