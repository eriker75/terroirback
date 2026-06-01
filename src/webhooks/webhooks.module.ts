import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { R4WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';

// El servicio sólo usa PrismaService (global) y ConfigService (global). Confirma
// el abono de forma atómica directamente sobre `payments`/`orders`, por lo que ya
// NO depende de PaymentsModule.
@Module({
  imports: [ConfigModule],
  controllers: [WebhooksController],
  providers: [R4WebhooksService],
})
export class WebhooksModule {}
