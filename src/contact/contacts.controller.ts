import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { QueryContactDto } from './dto/query-contact.dto';
import { Auth } from '../users/decorators/auth.decorators';
import { ValidRoles } from '../users/interfaces';

// Controlador del directorio de contactos (plural) para el dashboard admin.
// Se mantiene aparte de `@Controller('contact')` (mensajes/blocks) para evitar
// cualquier colisión de rutas.
@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @Auth(ValidRoles.admin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin] Directorio de contactos con su usuario y fuente(s)',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de contactos.' })
  findAll(@Query() query: QueryContactDto) {
    return this.contactService.findAllContacts(query);
  }
}
