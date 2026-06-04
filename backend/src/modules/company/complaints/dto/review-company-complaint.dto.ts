import { ComplaintStatus } from '@prisma/client';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const COMPANY_REVIEW_STATUSES = [
  ComplaintStatus.UNDER_REVIEW,
  ComplaintStatus.RESOLVED,
  ComplaintStatus.DISMISSED,
] as const;

export class ReviewCompanyComplaintDto {
  @IsIn(COMPANY_REVIEW_STATUSES)
  @IsNotEmpty()
  status!: (typeof COMPANY_REVIEW_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  companyNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  companyResponse?: string;
}
