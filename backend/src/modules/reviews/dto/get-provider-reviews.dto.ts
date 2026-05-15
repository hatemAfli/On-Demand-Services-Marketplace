import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GetProviderReviewsDto {
  /** Optional when `providerId` is supplied via route param (e.g. GET /reviews/provider/:providerId). */
  @IsOptional()
  @IsUUID()
  providerId?: string;

  /** Filter by specific service */
  @IsOptional()
  @IsUUID()
  givenServiceId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number;

  /** Default 10 in service layer when omitted */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  take?: number;

  /** Default 0 in service layer when omitted */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  /** Default `recent` in service layer when omitted */
  @IsOptional()
  @IsIn(['recent', 'highest', 'lowest'])
  sort?: string;
}
