import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FaqAudience } from '@prisma/client';

export class FaqTranslationInputDto {
  @IsString()
  @MinLength(2)
  question!: string;

  @IsString()
  @MinLength(2)
  answer!: string;
}

export class CreateFaqItemDto {
  @IsEnum(FaqAudience)
  audience!: FaqAudience;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ValidateNested()
  @Type(() => FaqTranslationInputDto)
  en!: FaqTranslationInputDto;

  @ValidateNested()
  @Type(() => FaqTranslationInputDto)
  ar!: FaqTranslationInputDto;
}

export class UpdateFaqItemDto {
  @IsOptional()
  @IsEnum(FaqAudience)
  audience?: FaqAudience;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => FaqTranslationInputDto)
  en?: FaqTranslationInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FaqTranslationInputDto)
  ar?: FaqTranslationInputDto;
}
