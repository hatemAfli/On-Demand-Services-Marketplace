import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../config/prisma.module';
import { SupabaseService } from '../../../config/supabase.config';
import { EmbeddingsModule } from '../../embeddings/embeddings.module';
import { CompanyServicesController } from './company-services.controller';
import { CompanyServicesService } from './company-services.service';
import { CompanyAuditModule } from '../audit/company-audit.module';

@Module({
  imports: [PrismaModule, CompanyAuditModule, EmbeddingsModule],
  controllers: [CompanyServicesController],
  providers: [CompanyServicesService, SupabaseService],
  exports: [CompanyServicesService],
})
export class CompanyServicesModule {}
