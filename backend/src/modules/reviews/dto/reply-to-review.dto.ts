import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyToReviewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  providerReply!: string;
}
