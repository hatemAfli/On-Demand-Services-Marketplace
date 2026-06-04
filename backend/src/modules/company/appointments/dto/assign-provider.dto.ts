import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AssignProviderDto {
  @IsUUID()
  providerId!: string;

  /** When true, also confirm the appointment in the same step. */
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
