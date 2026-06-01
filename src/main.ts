import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();

  // Crear directorio de uploads si no existe y servirlo como estático.
  // Debe coincidir con UPLOAD_ROOT que usa LocalStorageService, de lo contrario
  // los archivos se guardarían en una ruta y se servirían desde otra (404).
  const uploadsPath = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
  mkdirSync(uploadsPath, { recursive: true });
  app.useStaticAssets(uploadsPath, { prefix: '/uploads' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3001'],
    credentials: true,
  });

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
  
  // Bind explícito a 0.0.0.0 (requerido por Cloud Run; PORT lo inyecta el entorno).
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');

  // Cierre ordenado: libera el puerto al recargar (evita EADDRINUSE en dev) y
  // permite un apagado limpio en producción / Cloud Run.
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      void app.close().finally(() => process.exit(0));
    });
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});