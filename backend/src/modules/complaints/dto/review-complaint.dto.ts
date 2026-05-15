import { ComplaintDecision, ComplaintStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** Used by platform admin to update status and add notes/response/decision */
export class ReviewComplaintDto {
  @IsEnum(ComplaintStatus)
  status!: ComplaintStatus;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  adminNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminResponse?: string;

  @IsOptional()
  @IsEnum(ComplaintDecision)
  decision?: ComplaintDecision;
}
