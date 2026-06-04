import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  givenServiceId!: string;

  /**
   * Required for independent-provider bookings.
   * For company bookings it is optional: when omitted the company admin assigns
   * a provider later ("any available provider" mode).
   */
  @IsOptional()
  @IsUUID()
  providerId?: string;

  /**
   * Set when booking with a company. The company admin manages the request
   * (accept / refuse / reschedule / assign a free provider).
   */
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsDateString()
  scheduledDate!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  scheduledTime!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
