import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectVerificationRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  reason!: string;
}
