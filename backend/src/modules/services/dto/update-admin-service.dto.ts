import { Transform, Type } from 'class-transformer';
import {
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

class ServiceTranslationUpdateInputDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;
}

class ServiceTranslationsUpdateInputDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceTranslationUpdateInputDto)
  en?: ServiceTranslationUpdateInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceTranslationUpdateInputDto)
  ar?: ServiceTranslationUpdateInputDto;
}

export class UpdateAdminServiceDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ServiceTranslationsUpdateInputDto)
  translations?: ServiceTranslationsUpdateInputDto;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string; // deprecated: kept for backward compatibility

  /** Omit to leave unchanged; empty string clears the description. */
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string; // deprecated: kept for backward compatibility

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  /** Set to `null` or empty string to remove. Omit to leave unchanged. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '') return null;
    return value;
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  servicePhoto?: string | null;
}
