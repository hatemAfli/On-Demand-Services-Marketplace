import { AccountStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** Platform admin account management actions */
export class UpdateAdminUserStatusDto {
  @IsEnum(AccountStatus)
  status!: AccountStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
