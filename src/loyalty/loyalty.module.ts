import { Module } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';

// LoyaltyService sólo depende de PrismaService (global). Se exporta para que
// Orders/Payments/Webhooks acrediten puntos cuando un pedido pasa a PAID.
@Module({
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
