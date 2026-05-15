import { IsOptional, IsString, MaxLength } from 'class-validator';

export class WithdrawComplaintDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
