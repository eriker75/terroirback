import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class UserQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Buscar por nombre o email', example: 'maria' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ['customer', 'admin'], description: 'Filtrar por rol' })
  @IsOptional()
  @IsString()
  @IsIn(['customer', 'admin'])
  role?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive'], description: 'Filtrar por estado' })
  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: string;
}
