import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCompanyBrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logo?: string | null;
}
