import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../notifications/notifications.module';
import { CompanyComplaintsController } from './company-complaints.controller';
import { CompanyComplaintsService } from './company-complaints.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CompanyComplaintsController],
  providers: [CompanyComplaintsService],
  exports: [CompanyComplaintsService],
})
export class CompanyComplaintsModule {}
