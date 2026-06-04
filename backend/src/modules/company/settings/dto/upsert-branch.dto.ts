import { CompanyBranchStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertBranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subtitle?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsEnum(CompanyBranchStatus)
  status?: CompanyBranchStatus;
}
