import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateProductAttributeDto {
  @ApiProperty({ example: 'Color' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Rojo' })
  @IsString()
  @MaxLength(255)
  value: string;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Vino Tinto Reserva 2020' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'Vino tinto de uva Malbec con crianza de 12 meses en barrica.' })
  @IsString()
  description: string;

  @ApiProperty({ example: 45.99 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ example: 'https://cdn.ejemplo.com/vino.jpg' })
  @IsOptional()
  @IsString()
  mainImage?: string;

  @ApiPropertyOptional({ example: ['https://cdn.ejemplo.com/img1.jpg'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 'cldxxxxxxxxxxxxx' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: ['cldtag1', 'cldtag2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ type: [CreateProductAttributeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeDto)
  attributes?: CreateProductAttributeDto[];
}
