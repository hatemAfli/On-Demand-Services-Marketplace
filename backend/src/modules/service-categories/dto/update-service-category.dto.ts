import { Transform } from 'class-transformer';
import { Type } from 'class-transformer';
import {
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

class CategoryTranslationUpdateInputDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;
}

class CategoryTranslationsUpdateInputDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryTranslationUpdateInputDto)
  en?: CategoryTranslationUpdateInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryTranslationUpdateInputDto)
  ar?: CategoryTranslationUpdateInputDto;
}

export class UpdateServiceCategoryDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CategoryTranslationsUpdateInputDto)
  translations?: CategoryTranslationsUpdateInputDto;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string; // deprecated: kept for backward compatibility

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
