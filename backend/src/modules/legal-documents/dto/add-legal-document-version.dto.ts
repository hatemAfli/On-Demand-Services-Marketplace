import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AddLegalDocumentVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleEn!: string;

  @IsString()
  @MinLength(1)
  contentEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summaryEn?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleAr!: string;

  @IsString()
  @MinLength(1)
  contentAr!: string;

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
