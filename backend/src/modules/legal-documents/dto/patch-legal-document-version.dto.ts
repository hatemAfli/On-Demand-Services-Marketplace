import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Update draft body or publish a draft (admin). */
export class PatchLegalDocumentVersionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  contentEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summaryEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  contentAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summaryAr?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  publish?: boolean;
}
