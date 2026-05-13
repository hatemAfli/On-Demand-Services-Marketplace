import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GetMessagesDto {
  @IsUUID()
  conversationId!: string;

  /** Default 30 when omitted (apply in service layer). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  take?: number;

  /** Cursor: message `createdAt` ISO string (exclusive upper bound for older page). */
  @IsOptional()
  @IsDateString()
  before?: string;
}
