import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PricingType } from '@prisma/client';

export class UpdateGivenServiceDto {
  @IsOptional()
  @IsEnum(PricingType)
  pricingType?: PricingType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minimumHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  whatIsIncluded?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  whatIsNotIncluded?: string;

  @IsOptional()
  @IsBoolean()
  toolsProvidedByProvider?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  serviceAreaNotes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  advanceBookingRequiredHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsBoolean()
  isAvailableImmediately?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientMustProvide?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentMethodsAccepted?: string[];
}
