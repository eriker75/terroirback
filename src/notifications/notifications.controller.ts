import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PushTokensService } from './push-tokens.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import {
  RegisterPushTokenDto,
  SetPushTokenEnabledDto,
  UnregisterPushTokenDto,
} from './dto/register-push-token.dto';
import { SendTestPushDto } from './dto/send-test-push.dto';
import { Auth } from '../users/decorators/auth.decorators';
import { GetUser } from '../users/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { ValidRoles } from '../users/interfaces';
import { PaginationDto } from '../common/dto/pagination.dto';
import { BulkImportDto } from '../common/dto/bulk-import.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushTokensService: PushTokensService,
  ) {}

  // ── Cliente (app móvil): gestión de tokens push de Expo ────────────────────
  // Estas rutas estáticas van ANTES de las rutas `:id` de admin para que el
  // router de Nest no interprete "tokens"/"test" como un id de notificación.

  @Post('tokens')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Registrar/actualizar el token push del dispositivo',
  })
  @ApiResponse({ status: 201, description: 'Token registrado (upsert).' })
  registerToken(@GetUser() user: User, @Body() dto: RegisterPushTokenDto) {
    return this.pushTokensService.register(user.id, dto);
  }

  @Get('tokens')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar los dispositivos registrados del usuario' })
  listMyTokens(@GetUser() user: User) {
    return this.pushTokensService.listForUser(user.id);
  }

  @Patch('tokens')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activar/silenciar las notificaciones de un dispositivo',
  })
  setTokenEnabled(@GetUser() user: User, @Body() dto: SetPushTokenEnabledDto) {
    return this.pushTokensService.setEnabled(user.id, dto.token, dto.enabled);
  }

  @Delete('tokens')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dar de baja un token push (p.ej. al cerrar sesión)',
  })
  unregisterToken(@GetUser() user: User, @Body() dto: UnregisterPushTokenDto) {
    return this.pushTokensService.unregister(user.id, dto.token);
  }

  @Post('test')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Enviar una notificación de prueba a mis dispositivos',
  })
  @ApiResponse({ status: 201, description: 'Resultado del envío de prueba.' })
  sendTest(@GetUser() user: User, @Body() dto: SendTestPushDto) {
    return this.notificationsService.sendTestToUser(user.id, dto);
  }

  // ── Admin: campañas de notificaciones ──────────────────────────────────────

  @Post()
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Crear una notificación' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  // Admin: importación masiva desde CSV (crear / actualizar / upsert)
  @Post('bulk')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Importar notificaciones en lote (CSV)' })
  @ApiResponse({ status: 201, description: 'Reporte de importación.' })
  bulkImport(@Body() bulkImportDto: BulkImportDto) {
    return this.notificationsService.bulkImport(bulkImportDto);
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
  @ApiResponse({
    status: 200,
    description: 'Notificación marcada como enviada.',
  })
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
