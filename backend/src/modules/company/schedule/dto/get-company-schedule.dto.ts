import { IsDateString, IsOptional, IsString } from 'class-validator';

export class GetCompanyScheduleDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  search?: string;
}
