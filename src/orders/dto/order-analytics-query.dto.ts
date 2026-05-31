import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AnalyticsPeriod {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMIANNUAL = 'semiannual',
  ANNUAL = 'annual',
}

export class OrderAnalyticsQueryDto {
  @ApiProperty({ enum: AnalyticsPeriod, example: 'monthly' })
  @IsEnum(AnalyticsPeriod)
  period: AnalyticsPeriod;

  @ApiPropertyOptional({ example: 2026, description: 'Año para período mensual/trimestral/semestral' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2000)
  year?: number;

  @ApiPropertyOptional({ example: 2020, description: 'Año inicio para período anual' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2000)
  yearFrom?: number;

  @ApiPropertyOptional({ example: 2026, description: 'Año fin para período anual' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2000)
  yearTo?: number;
}
