import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { User } from '../users/entities/user.entity';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Auth } from '../users/decorators/auth.decorators';
import { GetUser } from '../users/decorators/get-user.decorator';
import { ValidRoles } from '../users/interfaces';

@ApiTags('orders')
@ApiBearerAuth()
@Auth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Customer ─────────────────────────────────────────────────────────────

  // El userId del pedido debe coincidir con el usuario autenticado
  @Post()
  @ApiOperation({ summary: 'Crear un nuevo pedido' })
  @ApiResponse({ status: 201, description: 'Pedido creado correctamente.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 403, description: 'No puedes crear pedidos para otro usuario.' })
  create(@Body() createOrderDto: CreateOrderDto, @GetUser() authUser: User) {
    if (authUser.role !== 'admin' && createOrderDto.userId !== authUser.id) {
      throw new ForbiddenException('No puedes crear pedidos para otro usuario');
    }
    return this.ordersService.create(createOrderDto);
  }

  // Ownership: el customer solo puede ver su propio pedido
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un pedido por ID' })
  @ApiParam({ name: 'id', description: 'ID del pedido (cuid)' })
  @ApiResponse({ status: 200, description: 'Pedido encontrado.' })
  @ApiResponse({ status: 403, description: 'No tienes acceso a este pedido.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  async findOne(@Param('id') id: string, @GetUser() authUser: User) {
    const order = await this.ordersService.findOne(id);
    if (authUser.role !== 'admin' && order.userId !== authUser.id) {
      throw new ForbiddenException('No tienes acceso a este pedido');
    }
    return order;
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  @Get()
  @Auth(ValidRoles.admin)
  @ApiOperation({ summary: '[Admin] Obtener todos los pedidos' })
  @ApiResponse({ status: 200, description: 'Lista de pedidos.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  findAll() {
    return this.ordersService.findAll();
  }

  @Patch(':id')
  @Auth(ValidRoles.admin)
  @ApiOperation({ summary: '[Admin] Actualizar estado de un pedido' })
  @ApiParam({ name: 'id', description: 'ID del pedido (cuid)' })
  @ApiResponse({ status: 200, description: 'Pedido actualizado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.admin)
  @ApiOperation({ summary: '[Admin] Cancelar / eliminar un pedido' })
  @ApiParam({ name: 'id', description: 'ID del pedido (cuid)' })
  @ApiResponse({ status: 200, description: 'Pedido eliminado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado.' })
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
