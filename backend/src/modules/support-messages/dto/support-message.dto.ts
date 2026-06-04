import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { SupportMessageStatus } from '@prisma/client';

export class CreateSupportMessageDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  subject!: string;

  @IsString()
  @MinLength(10)
  message!: string;
}

export class ListAdminSupportMessagesQueryDto {
  @IsOptional()
  @IsEnum(SupportMessageStatus)
  status?: SupportMessageStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

export class UpdateSupportMessageStatusDto {
  @IsEnum(SupportMessageStatus)
  status!: SupportMessageStatus;
}
