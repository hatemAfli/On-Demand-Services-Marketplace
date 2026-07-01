import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DocumentType, ProviderType, UserRole } from '@prisma/client';

class LegalAcceptancesDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsUUID('4', { each: true })
  documentVersionIds!: string[];
}

class CompleteRegistrationClientDto {
  @IsString()
  @MinLength(1)
  city!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

class CompleteRegistrationDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;

  @IsString()
  @MinLength(1)
  fichierUrl!: string;
}

class CompleteRegistrationProviderVerificationDto {
  @IsUUID()
  serviceId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompleteRegistrationDocumentDto)
  documents!: CompleteRegistrationDocumentDto[];
}

class CompleteRegistrationProviderDto {
  @IsOptional()
  @IsEnum(ProviderType)
  type?: ProviderType;

  @IsString()
  @MinLength(1)
  city!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CompleteRegistrationProviderVerificationDto)
  verification?: CompleteRegistrationProviderVerificationDto;
}

class CompleteRegistrationCompanyDto {
  @IsString()
  @MinLength(1)
  companyName!: string;

  @IsString()
  @MinLength(1)
  taxId!: string;

  @IsString()
  @MinLength(1)
  city!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceZones?: string[];

  @IsOptional()
  @IsString()
  logo?: string;
}

class CompleteRegistrationCompanyVerificationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompleteRegistrationDocumentDto)
  documents!: CompleteRegistrationDocumentDto[];
}

class CompleteRegistrationCompanyAdminDto {
  @ValidateNested()
  @Type(() => CompleteRegistrationCompanyDto)
  company!: CompleteRegistrationCompanyDto;

  @ValidateNested()
  @Type(() => CompleteRegistrationCompanyVerificationDto)
  verification!: CompleteRegistrationCompanyVerificationDto;
}

export class CompleteRegistrationDto {
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @ValidateNested()
  @Type(() => LegalAcceptancesDto)
  legalAcceptances!: LegalAcceptancesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CompleteRegistrationClientDto)
  client?: CompleteRegistrationClientDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CompleteRegistrationProviderDto)
  provider?: CompleteRegistrationProviderDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CompleteRegistrationCompanyAdminDto)
  companyAdmin?: CompleteRegistrationCompanyAdminDto;
}
