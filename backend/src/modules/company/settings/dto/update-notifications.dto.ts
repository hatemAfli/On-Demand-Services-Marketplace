import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationsDto {
  @IsOptional()
  @IsBoolean()
  newOrderAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  providerStatusUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyReport?: boolean;

  @IsOptional()
  @IsBoolean()
  systemAnnouncements?: boolean;
}
