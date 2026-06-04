import { DashboardTheme } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCompanyBrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  brandColor?: string;

  @IsOptional()
  @IsEnum(DashboardTheme)
  dashboardTheme?: DashboardTheme;
}
