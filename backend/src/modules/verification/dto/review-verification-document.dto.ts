import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export type DocumentReviewDecision = 'accept' | 'reject';

export class ReviewVerificationDocumentDto {
  @IsString()
  @IsIn(['accept', 'reject'])
  decision!: DocumentReviewDecision;

  @ValidateIf((o: ReviewVerificationDocumentDto) => o.decision === 'reject')
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  rejectionReason?: string;
}
