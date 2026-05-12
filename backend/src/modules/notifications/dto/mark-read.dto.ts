import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class MarkNotificationsReadDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  ids?: string[];
}
