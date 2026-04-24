import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');


  const config = new DocumentBuilder()
    .setTitle('Terroir E-commerce API')
    .setDescription(
      'API REST para la plataforma de e-commerce Terroir. Gestiona usuarios, productos, pedidos, carrito, wishlist, cupones, categorías, etiquetas, banners y notificaciones.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('users', 'Gestión de usuarios')
    .addTag('products', 'Catálogo de productos')
    .addTag('categories', 'Categorías de productos')
    .addTag('tags', 'Etiquetas de productos')
    .addTag('orders', 'Pedidos y pagos')
    .addTag('cart', 'Carrito de compras')
    .addTag('wishlist', 'Lista de deseos')
    .addTag('addresses', 'Direcciones de envío')
    .addTag('coupons', 'Cupones de descuento')
    .addTag('banners', 'Banners promocionales')
    .addTag('notifications', 'Notificaciones')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().then(console.log).catch(console.log);
