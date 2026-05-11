import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  givenServiceId!: string;

  @IsUUID()
  providerId!: string;

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
  @IsString({ each: true })
  photoUrls?: string[];
}
