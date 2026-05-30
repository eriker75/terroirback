import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { Auth } from '../users/decorators/auth.decorators';
import { ValidRoles } from '../users/interfaces';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Crear una notificación' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Get()
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Listar notificaciones' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.notificationsService.findAll(paginationDto);
  }

  @Get(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Obtener una notificación' })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  findOne(@Param('id') id: string) {
    return this.notificationsService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Actualizar una notificación' })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  update(@Param('id') id: string, @Body() dto: UpdateNotificationDto) {
    return this.notificationsService.update(id, dto);
  }

  @Post(':id/send')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Enviar notificación ahora' })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  @ApiResponse({ status: 200, description: 'Notificación marcada como enviada.' })
  sendNow(@Param('id') id: string) {
    return this.notificationsService.sendNow(id);
  }

  @Delete(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Eliminar una notificación' })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}
