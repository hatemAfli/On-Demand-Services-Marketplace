import { PricingType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Provider-editable fields for their `GivenService` (catalog `serviceId` in URL). */
export class UpdateProviderGivenServiceDto {
  @IsOptional()
  @IsEnum(PricingType)
  pricingType?: PricingType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumHours?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDurationMinutes?: number | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  whatIsIncluded?: string | null;

  @IsOptional()
  @IsString()
  whatIsNotIncluded?: string | null;

  @IsOptional()
  @IsString()
  clientMustProvide?: string | null;

  @IsOptional()
  @IsString()
  serviceAreaNotes?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  advanceBookingRequiredHours?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20000)
  serviceRadiusKm?: number | null;

  @IsOptional()
  @IsBoolean()
  toolsProvidedByProvider?: boolean | null;

  @IsOptional()
  @IsBoolean()
  isAvailableImmediately?: boolean | null;
}
