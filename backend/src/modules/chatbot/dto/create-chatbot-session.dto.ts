import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateChatbotSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;
}
