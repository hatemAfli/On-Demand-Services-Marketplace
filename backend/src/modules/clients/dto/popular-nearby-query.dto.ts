import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

const toOptionalNumber = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

export class PopularNearbyQueryDto {
  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  clientLat?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  clientLng?: number;

  @IsOptional()
  @IsString()
  lang?: string;
}
