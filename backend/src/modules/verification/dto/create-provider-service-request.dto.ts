import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DocumentType } from '@prisma/client';

class CreateProviderServiceRequestDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;

  @IsString()
  @MinLength(1)
  fichierUrl!: string;
}

export class CreateProviderServiceRequestDto {
  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  ownerComment?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProviderServiceRequestDocumentDto)
  documents!: CreateProviderServiceRequestDocumentDto[];
}
