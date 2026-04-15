import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Vinos Tintos' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'vinos-tintos' })
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers and hyphens only',
  })
  slug: string;

  @ApiPropertyOptional({ example: 'cldcategory123' })
  @IsOptional()
  @IsString()
  parentId?: string;
}
