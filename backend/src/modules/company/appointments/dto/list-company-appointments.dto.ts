import { AppointmentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const toOptionalInt = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? value : parsed;
};

export class ListCompanyAppointmentsDto {
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  /** "unassigned" filter is handled in the service (providerId is null). */
  @IsOptional()
  @IsString()
  assignment?: 'ASSIGNED' | 'UNASSIGNED';

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  take?: number;
}
