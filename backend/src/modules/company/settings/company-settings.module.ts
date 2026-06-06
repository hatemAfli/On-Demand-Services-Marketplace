import { Module } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.config';
import { CompanyAuditModule } from '../audit/company-audit.module';
import { CompanySettingsController } from './company-settings.controller';
import { CompanySettingsService } from './company-settings.service';

@Module({
  imports: [CompanyAuditModule],
  controllers: [CompanySettingsController],
  providers: [CompanySettingsService, SupabaseService],
  exports: [CompanySettingsService],
})
export class CompanySettingsModule {}
