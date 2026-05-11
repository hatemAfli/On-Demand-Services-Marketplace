import { OwnerType, PricingType, ProviderGender } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum SortOption {
  RECOMMENDED = 'RECOMMENDED',
  RATING_DESC = 'RATING_DESC',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  JOBS_DESC = 'JOBS_DESC',
  NEWEST = 'NEWEST',
}

const unwrapQueryValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const stripWrappingQuotes = (value: string): string => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const toOptionalNumber = ({ value }: { value: unknown }): unknown => {
  const raw = unwrapQueryValue(value);
  if (raw === undefined || raw === null || raw === '') return undefined;
  const normalized = typeof raw === 'string' ? stripWrappingQuotes(raw) : raw;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? value : parsed;
};

const toOptionalInt = ({ value }: { value: unknown }): unknown => {
  const raw = unwrapQueryValue(value);
  if (raw === undefined || raw === null || raw === '') return undefined;
  const normalized = typeof raw === 'string' ? stripWrappingQuotes(raw) : raw;
  const parsed = Number.parseInt(String(normalized), 10);
  return Number.isNaN(parsed) ? value : parsed;
};

const toOptionalBoolean = ({ value }: { value: unknown }): unknown => {
  const raw = unwrapQueryValue(value);
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const normalized = stripWrappingQuotes(raw).toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    if (normalized === '1') return true;
    if (normalized === '0') return false;
  }
  return value;
};

export class SearchGivenServicesDto {
  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  clientLat?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  clientLng?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsEnum(OwnerType)
  ownerType?: OwnerType;

  @IsOptional()
  @IsEnum(PricingType)
  pricingType?: PricingType;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isAvailableImmediately?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isTopProvider?: boolean;

  @IsOptional()
  @IsEnum(ProviderGender)
  gender?: ProviderGender;

  @IsOptional()
  @IsString()
  sort: string = SortOption.RECOMMENDED;

  @IsOptional()
  @IsString()
  locale: string = 'EN';

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
