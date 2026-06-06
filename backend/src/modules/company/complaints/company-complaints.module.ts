import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../notifications/notifications.module';
import { CompanyAuditModule } from '../audit/company-audit.module';
import { CompanyComplaintsController } from './company-complaints.controller';
import { CompanyComplaintsService } from './company-complaints.service';

@Module({
  imports: [NotificationsModule, CompanyAuditModule],
  controllers: [CompanyComplaintsController],
  providers: [CompanyComplaintsService],
  exports: [CompanyComplaintsService],
})
export class CompanyComplaintsModule {}
