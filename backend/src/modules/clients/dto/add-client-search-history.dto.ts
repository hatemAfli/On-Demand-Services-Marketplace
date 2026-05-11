import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddClientSearchHistoryDto {
  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  query?: string;
}
