import { DocumentType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ResubmitVerificationDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;

  @IsString()
  @MinLength(1)
  fichierUrl!: string;
}

export class ResubmitVerificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  ownerComment?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResubmitVerificationDocumentDto)
  documents!: ResubmitVerificationDocumentDto[];
}
