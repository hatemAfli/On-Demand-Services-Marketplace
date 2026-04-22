import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LegalDocumentType } from '@prisma/client';

export class LatestLegalDocumentQueryDto {
  @IsEnum(LegalDocumentType)
  type!: LegalDocumentType;

  /** Same convention as `/service-categories`: `en` / `ar` (optional). */
  @IsOptional()
  @IsString()
  lang?: string;
}
