import { Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { R4WebhooksService } from './webhooks.service';
import { R4WebhookNotificaDto } from './dto/r4-webhook-notifica.dto';
import { R4WebhookConsultaDto } from './dto/r4-webhook-consulta.dto';

// Webhooks de R4. Sin @Auth: R4 autentica por el header Authorization, que el
// servicio valida de forma NO bloqueante. Leemos el cuerpo crudo (@Req) para
// que el ValidationPipe global (whitelist + forbidNonWhitelisted) no descarte
// ni rechace los campos PascalCase que envía R4.
@ApiTags('R4 Webhooks')
@Controller('webhooks/r4')
export class WebhooksController {
  constructor(private readonly webhooksService: R4WebhooksService) {}

  @Post('notifica')
  @ApiOperation({ summary: 'Notificación de abono (pago móvil) desde R4' })
  notifica(@Req() req: Request, @Headers('authorization') auth?: string) {
    return this.webhooksService.handleNotifica(req.body as R4WebhookNotificaDto, auth);
  }

  @Post('consulta')
  @ApiOperation({ summary: 'Consulta de disponibilidad desde R4' })
  consulta(@Req() req: Request, @Headers('authorization') auth?: string) {
    return this.webhooksService.handleConsulta(req.body as R4WebhookConsultaDto, auth);
  }
}
