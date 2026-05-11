import { DayOfWeek } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class UpsertAvailabilityDto {
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @IsBoolean()
  isWorking!: boolean;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime!: string;
}

export class UpsertAvailabilityBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertAvailabilityDto)
  days!: UpsertAvailabilityDto[];
}
