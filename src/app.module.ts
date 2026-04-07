import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CartModule } from './cart/cart.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { UsersModule } from './users/users.module';
import { CategoryModule } from './category/category.module';
import { TagsModule } from './tags/tags.module';
import { AddressModule } from './address/address.module';
import { CouponsModule } from './coupons/coupons.module';
import { BannersModule } from './banners/banners.module';

@Module({
  imports: [
    OrdersModule,
    ProductsModule,
    NotificationsModule,
    CartModule,
    WishlistModule,
    UsersModule,
    CategoryModule,
    TagsModule,
    AddressModule,
    CouponsModule,
    BannersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
