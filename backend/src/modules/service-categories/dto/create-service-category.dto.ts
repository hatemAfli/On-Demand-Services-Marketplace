import { Transform } from 'class-transformer';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsUrl,
  ValidateNested,
} from 'class-validator';

class CategoryTranslationInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

class CategoryTranslationsInputDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CategoryTranslationInputDto)
  en!: CategoryTranslationInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryTranslationInputDto)
  ar?: CategoryTranslationInputDto;
}

export class CreateServiceCategoryDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CategoryTranslationsInputDto)
  translations!: CategoryTranslationsInputDto;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string; // deprecated: kept for backward compatibility

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers, and single hyphens',
  })
  slug?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(80)
  iconKey?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_tld: false })
  iconUrl?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;
}
