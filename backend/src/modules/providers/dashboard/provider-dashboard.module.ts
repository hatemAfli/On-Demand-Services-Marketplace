import { Module } from '@nestjs/common';
import { ProviderDashboardService } from './provider-dashboard.service';

@Module({
  providers: [ProviderDashboardService],
  exports: [ProviderDashboardService],
})
export class ProviderDashboardModule {}
