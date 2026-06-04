import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const toOptionalInt = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? value : parsed;
};

export class GetRescheduleOptionsDto {
  /** Single day to load (YYYY-MM-DD). Preferred — fast. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  /** Bulk scan when `date` is omitted (defaults to 30 days, parallelized). */
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(7)
  @Max(90)
  days?: number;
}
