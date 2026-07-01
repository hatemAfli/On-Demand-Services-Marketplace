import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsUUID()
  sessionId!: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
