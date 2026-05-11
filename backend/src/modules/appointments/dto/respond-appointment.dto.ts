import { IsEnum, IsOptional, IsString, IsDateString, Matches } from 'class-validator';

export enum ProviderRespondAction {
  CONFIRMED = 'CONFIRMED',
  REFUSED = 'REFUSED',
  RESCHEDULED = 'RESCHEDULED',
}

export class RespondAppointmentDto {
  @IsEnum(ProviderRespondAction)
  action!: ProviderRespondAction;

  @IsOptional()
  @IsString()
  refusalReason?: string;

  @IsOptional()
  @IsDateString()
  rescheduleDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  rescheduleTime?: string;
}
