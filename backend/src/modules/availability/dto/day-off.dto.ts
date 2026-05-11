import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateDayOffDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
