import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../config/prisma.module';
import { CompanyAuditService } from './company-audit.service';

@Module({
  imports: [PrismaModule],
  providers: [CompanyAuditService],
  exports: [CompanyAuditService],
})
export class CompanyAuditModule {}
