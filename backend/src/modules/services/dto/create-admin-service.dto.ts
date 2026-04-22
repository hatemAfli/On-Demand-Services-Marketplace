import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

class ServiceTranslationInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(10_000)
  description?: string;
}

class ServiceTranslationsInputDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => ServiceTranslationInputDto)
  en!: ServiceTranslationInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceTranslationInputDto)
  ar?: ServiceTranslationInputDto;
}

export class CreateAdminServiceDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ServiceTranslationsInputDto)
  translations!: ServiceTranslationsInputDto;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string; // deprecated: kept for backward compatibility

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(10_000)
  description?: string; // deprecated: kept for backward compatibility

  /** Target `ServiceCategory` id (required). */
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  /** Public URL of the catalog image (typically Supabase Storage `service_photos/...`). */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  servicePhoto?: string;
}
