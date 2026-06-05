import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpsertUserSettingsDto } from './dto/upsert-user-settings.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Auth } from './decorators/auth.decorators';
import { GetUser } from './decorators/get-user.decorator';
import { User } from './entities/user.entity';
import { ValidRoles } from './interfaces';
import { UserQueryDto } from './dto/user-query.dto';
import { BulkImportDto } from '../common/dto/bulk-import.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Auth ──────────────────────────────────────────────────────────────────────

  @Post('register')
  @ApiOperation({ summary: 'Registrar un nuevo cliente' })
  @ApiResponse({ status: 201, description: 'Cliente registrado. Devuelve accessToken + refreshToken.' })
  @ApiResponse({ status: 409, description: 'El correo ya está registrado.' })
  register(@Body() registerUserDto: RegisterUserDto) {
    return this.usersService.register(registerUserDto);
  }

  @Post('register-admin')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Registrar un nuevo administrador' })
  @ApiResponse({ status: 201, description: 'Administrador registrado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos.' })
  registerAdmin(@Body() registerUserDto: RegisterUserDto) {
    return this.usersService.registerAdmin(registerUserDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso. Devuelve accessToken + refreshToken.' })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas.' })
  login(@Body() loginUserDto: LoginUserDto) {
    return this.usersService.login(loginUserDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Renovar access token con refresh token (rotación)' })
  @ApiResponse({ status: 200, description: 'Nuevo par de tokens emitido.' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado.' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.usersService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión y revocar refresh token' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.usersService.logout(dto.refreshToken);
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────────

  @Post()
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Crear usuario con control total' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // Admin: importación masiva de clientes desde CSV (crear / actualizar / upsert)
  @Post('bulk')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Importar clientes en lote (CSV)' })
  @ApiResponse({ status: 201, description: 'Reporte de importación.' })
  bulkImport(@Body() bulkImportDto: BulkImportDto) {
    return this.usersService.bulkImport(bulkImportDto);
  }

  @Get()
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Listar usuarios con paginación, búsqueda y filtros' })
  findAll(@Query() queryDto: UserQueryDto) {
    return this.usersService.findAll(queryDto);
  }

  @Get('stats')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Totales de clientes: total, activos, inactivos' })
  getCustomerStats() {
    return this.usersService.getCustomerStats();
  }

  // ── Cambio de contraseña (verifica la actual; el dueño o un admin) ─────────

  @Post(':id/change-password')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar la contraseña (verifica la actual)' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 401, description: 'La contraseña actual es incorrecta.' })
  @ApiResponse({ status: 403, description: 'No puedes cambiar la contraseña de otro usuario.' })
  changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @GetUser() authUser: User,
  ) {
    if (authUser.role !== 'admin' && authUser.id !== id) {
      throw new ForbiddenException('No puedes cambiar la contraseña de otro usuario');
    }
    return this.usersService.changePassword(id, dto.currentPassword, dto.newPassword);
  }

  // ── User settings (preferencias propias; el dueño o un admin) ──────────────

  @Get(':id/settings')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar los settings del usuario (filtrar por ?group=)' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 403, description: 'No puedes ver los settings de otro usuario.' })
  getSettings(
    @Param('id') id: string,
    @Query('group') group: string | undefined,
    @GetUser() authUser: User,
  ) {
    if (authUser.role !== 'admin' && authUser.id !== id) {
      throw new ForbiddenException('No tienes acceso a los settings de otro usuario');
    }
    return this.usersService.getUserSettings(id, group);
  }

  @Patch(':id/settings')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear/actualizar settings del usuario (upsert por metaKey)' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 403, description: 'No puedes modificar los settings de otro usuario.' })
  upsertSettings(
    @Param('id') id: string,
    @Body() dto: UpsertUserSettingsDto,
    @GetUser() authUser: User,
  ) {
    if (authUser.role !== 'admin' && authUser.id !== id) {
      throw new ForbiddenException('No tienes acceso a los settings de otro usuario');
    }
    return this.usersService.upsertUserSettings(id, dto.settings);
  }

  @Get(':id')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener usuario por ID (propio, o cualquiera si admin)' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 403, description: 'No puedes ver el perfil de otro usuario.' })
  findOne(@Param('id') id: string, @GetUser() authUser: User) {
    // Evita IDOR: un customer sólo puede ver su propio perfil; el admin, cualquiera.
    if (authUser.role !== 'admin' && authUser.id !== id) {
      throw new ForbiddenException('No tienes acceso al perfil de otro usuario');
    }
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar usuario (propio, o cualquiera si admin)' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 403, description: 'No puedes modificar el perfil de otro usuario.' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() authUser: User,
  ) {
    // Evita IDOR: sólo el dueño o un admin pueden modificar.
    if (authUser.role !== 'admin' && authUser.id !== id) {
      throw new ForbiddenException('No tienes acceso al perfil de otro usuario');
    }
    // Evita escalada de privilegios: un no-admin NO puede cambiar role/status, ni
    // auto-promoverse a mayorista (accountType) para obtener precios/visibilidad B2B.
    if (authUser.role !== 'admin') {
      delete updateUserDto.role;
      delete updateUserDto.status;
      delete updateUserDto.accountType;
    }
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Eliminar usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
