import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { User } from '../users/entities/user.entity';
import { CartService } from './cart.service';
import { CreateCartDto } from './dto/create-cart.dto';
import {
  AddCartItemDto,
  ApplyCartCouponDto,
  ApplyGroupCouponDto,
  ReplaceCartItemsDto,
  UpdateCartDto,
  UpdateCartItemDto,
} from './dto/update-cart.dto';
import { Auth } from '../users/decorators/auth.decorators';
import { GetUser } from '../users/decorators/get-user.decorator';
import { ValidRoles } from '../users/interfaces';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('cart')
@ApiBearerAuth()
@Auth()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private checkOwnership(authUser: User, userId: string): void {
    if (authUser.role !== 'admin' && authUser.id !== userId) {
      throw new ForbiddenException('No tienes acceso al carrito de otro usuario');
    }
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  @Post()
  @Auth(ValidRoles.admin)
  @ApiOperation({ summary: '[Admin] Crear un carrito para un usuario' })
  @ApiResponse({ status: 201, description: 'Carrito creado correctamente.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  create(@Body() createCartDto: CreateCartDto) {
    return this.cartService.create(createCartDto);
  }

  @Get()
  @Auth(ValidRoles.admin)
  @ApiOperation({ summary: '[Admin] Obtener todos los carritos' })
  @ApiResponse({ status: 200, description: 'Lista de carritos.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.cartService.findAll(paginationDto);
  }

  @Get(':id')
  @Auth(ValidRoles.admin)
  @ApiOperation({ summary: '[Admin] Obtener un carrito por ID interno' })
  @ApiParam({ name: 'id', description: 'ID del carrito (cuid)' })
  @ApiResponse({ status: 200, description: 'Carrito encontrado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  @ApiResponse({ status: 404, description: 'Carrito no encontrado.' })
  findOne(@Param('id') id: string) {
    return this.cartService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin)
  @ApiOperation({ summary: '[Admin] Actualizar un carrito' })
  @ApiParam({ name: 'id', description: 'ID del carrito (cuid)' })
  @ApiResponse({ status: 200, description: 'Carrito actualizado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  update(@Param('id') id: string, @Body() updateCartDto: UpdateCartDto) {
    return this.cartService.update(id, updateCartDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.admin)
  @ApiOperation({ summary: '[Admin] Eliminar un carrito' })
  @ApiParam({ name: 'id', description: 'ID del carrito (cuid)' })
  @ApiResponse({ status: 200, description: 'Carrito eliminado.' })
  @ApiResponse({ status: 403, description: 'Sin permisos suficientes.' })
  remove(@Param('id') id: string) {
    return this.cartService.remove(id);
  }

  // ── Customer (con verificación de pertenencia) ───────────────────────────

  @Get('user/:userId')
  @ApiOperation({ summary: 'Obtener el carrito propio' })
  @ApiParam({ name: 'userId', description: 'ID del usuario (cuid)' })
  @ApiResponse({ status: 200, description: 'Carrito del usuario.' })
  @ApiResponse({ status: 403, description: 'No puedes acceder al carrito de otro usuario.' })
  findByUser(@Param('userId') userId: string, @GetUser() authUser: User) {
    this.checkOwnership(authUser, userId);
    return this.cartService.findByUserId(userId);
  }

  @Post('user/:userId/items')
  @ApiOperation({ summary: 'Agregar un producto al carrito' })
  @ApiParam({ name: 'userId', description: 'ID del usuario (cuid)' })
  @ApiResponse({ status: 201, description: 'Producto agregado al carrito.' })
  @ApiResponse({ status: 403, description: 'No puedes modificar el carrito de otro usuario.' })
  addProduct(
    @Param('userId') userId: string,
    @Body() body: AddCartItemDto,
    @GetUser() authUser: User,
  ) {
    this.checkOwnership(authUser, userId);
    return this.cartService.addProduct(userId, body.productId, body.quantity ?? 1);
  }

  @Patch('user/:userId/items/:productId')
  @ApiOperation({ summary: 'Actualizar la cantidad de un ítem en el carrito' })
  @ApiParam({ name: 'userId', description: 'ID del usuario (cuid)' })
  @ApiParam({ name: 'productId', description: 'ID del producto (cuid)' })
  @ApiResponse({ status: 200, description: 'Cantidad actualizada.' })
  @ApiResponse({ status: 403, description: 'No puedes modificar el carrito de otro usuario.' })
  updateItemQuantity(
    @Param('userId') userId: string,
    @Param('productId') productId: string,
    @Body() body: UpdateCartItemDto,
    @GetUser() authUser: User,
  ) {
    this.checkOwnership(authUser, userId);
    return this.cartService.updateItemQuantity(userId, productId, body.quantity);
  }

  @Patch('user/:userId/items')
  @ApiOperation({ summary: 'Reemplazar todos los ítems del carrito' })
  @ApiParam({ name: 'userId', description: 'ID del usuario (cuid)' })
  @ApiResponse({ status: 200, description: 'Ítems reemplazados.' })
  @ApiResponse({ status: 403, description: 'No puedes modificar el carrito de otro usuario.' })
  replaceItems(
    @Param('userId') userId: string,
    @Body() body: ReplaceCartItemsDto,
    @GetUser() authUser: User,
  ) {
    this.checkOwnership(authUser, userId);
    return this.cartService.replaceItems(userId, body.items);
  }

  @Delete('user/:userId/items/:productId')
  @ApiOperation({ summary: 'Eliminar un producto del carrito' })
  @ApiParam({ name: 'userId', description: 'ID del usuario (cuid)' })
  @ApiParam({ name: 'productId', description: 'ID del producto (cuid)' })
  @ApiResponse({ status: 200, description: 'Producto eliminado del carrito.' })
  @ApiResponse({ status: 403, description: 'No puedes modificar el carrito de otro usuario.' })
  removeProduct(
    @Param('userId') userId: string,
    @Param('productId') productId: string,
    @GetUser() authUser: User,
  ) {
    this.checkOwnership(authUser, userId);
    return this.cartService.removeProduct(userId, productId);
  }

  @Delete('user/:userId/items')
  @ApiOperation({ summary: 'Vaciar el carrito' })
  @ApiParam({ name: 'userId', description: 'ID del usuario (cuid)' })
  @ApiResponse({ status: 200, description: 'Carrito vaciado.' })
  @ApiResponse({ status: 403, description: 'No puedes vaciar el carrito de otro usuario.' })
  clearByUser(@Param('userId') userId: string, @GetUser() authUser: User) {
    this.checkOwnership(authUser, userId);
    return this.cartService.clearByUser(userId);
  }

  @Post('user/:userId/coupons/apply-cart')
  @ApiOperation({ summary: 'Aplicar un cupón al carrito completo' })
  @ApiParam({ name: 'userId', description: 'ID del usuario (cuid)' })
  @ApiResponse({ status: 201, description: 'Cupón aplicado al carrito.' })
  @ApiResponse({ status: 403, description: 'No puedes modificar el carrito de otro usuario.' })
  @ApiResponse({ status: 404, description: 'Cupón o carrito no encontrado.' })
  applyCouponToCart(
    @Param('userId') userId: string,
    @Body() body: ApplyCartCouponDto,
    @GetUser() authUser: User,
  ) {
    this.checkOwnership(authUser, userId);
    return this.cartService.applyCouponToCart(userId, body.couponCode);
  }

  @Post('user/:userId/coupons/apply-item/:productId')
  @ApiOperation({ summary: 'Aplicar un cupón a un ítem específico del carrito' })
  @ApiParam({ name: 'userId', description: 'ID del usuario (cuid)' })
  @ApiParam({ name: 'productId', description: 'ID del producto (cuid)' })
  @ApiResponse({ status: 201, description: 'Cupón aplicado al ítem.' })
  @ApiResponse({ status: 403, description: 'No puedes modificar el carrito de otro usuario.' })
  applyCouponToItem(
    @Param('userId') userId: string,
    @Param('productId') productId: string,
    @Body() body: ApplyCartCouponDto,
    @GetUser() authUser: User,
  ) {
    this.checkOwnership(authUser, userId);
    return this.cartService.applyCouponToItem(userId, productId, body.couponCode);
  }

  @Post('user/:userId/coupons/apply-group')
  @ApiOperation({ summary: 'Aplicar un cupón a un grupo de productos del carrito' })
  @ApiParam({ name: 'userId', description: 'ID del usuario (cuid)' })
  @ApiResponse({ status: 201, description: 'Cupón aplicado al grupo de productos.' })
  @ApiResponse({ status: 403, description: 'No puedes modificar el carrito de otro usuario.' })
  applyCouponToGroup(
    @Param('userId') userId: string,
    @Body() body: ApplyGroupCouponDto,
    @GetUser() authUser: User,
  ) {
    this.checkOwnership(authUser, userId);
    return this.cartService.applyCouponToGroup(userId, body.productIds, body.couponCode);
  }

  @Delete('user/:userId/coupons/:applicationId')
  @ApiOperation({ summary: 'Eliminar una aplicación de cupón del carrito' })
  @ApiParam({ name: 'userId', description: 'ID del usuario (cuid)' })
  @ApiParam({ name: 'applicationId', description: 'ID de la aplicación del cupón (cuid)' })
  @ApiResponse({ status: 200, description: 'Aplicación de cupón eliminada.' })
  @ApiResponse({ status: 403, description: 'No puedes modificar el carrito de otro usuario.' })
  removeCouponApplication(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
    @GetUser() authUser: User,
  ) {
    this.checkOwnership(authUser, userId);
    return this.cartService.removeCouponApplication(userId, applicationId);
  }

  @Delete('user/:userId/coupons')
  @ApiOperation({ summary: 'Eliminar todas las aplicaciones de cupones del carrito' })
  @ApiParam({ name: 'userId', description: 'ID del usuario (cuid)' })
  @ApiResponse({ status: 200, description: 'Todas las aplicaciones de cupones eliminadas.' })
  @ApiResponse({ status: 403, description: 'No puedes modificar el carrito de otro usuario.' })
  clearCouponApplications(
    @Param('userId') userId: string,
    @GetUser() authUser: User,
  ) {
    this.checkOwnership(authUser, userId);
    return this.cartService.clearCouponApplications(userId);
  }
}
