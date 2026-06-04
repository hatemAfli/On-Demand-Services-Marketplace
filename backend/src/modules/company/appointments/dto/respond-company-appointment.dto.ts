import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export enum CompanyRespondAction {
  CONFIRMED = 'CONFIRMED',
  REFUSED = 'REFUSED',
  RESCHEDULED = 'RESCHEDULED',
}

export class RespondCompanyAppointmentDto {
  @IsEnum(CompanyRespondAction)
  action!: CompanyRespondAction;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  refusalReason?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  rescheduleDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  rescheduleTime?: string;
}
