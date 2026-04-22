import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateLegalDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titleAr?: string;
}
