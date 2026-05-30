import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Auth } from './decorators/auth.decorators';
import { ValidRoles } from './interfaces';
import { UserQueryDto } from './dto/user-query.dto';

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

  @Get(':id')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
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
