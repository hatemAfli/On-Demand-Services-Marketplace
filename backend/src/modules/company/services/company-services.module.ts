import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../config/prisma.module';
import { SupabaseService } from '../../../config/supabase.config';
import { CompanyServicesController } from './company-services.controller';
import { CompanyServicesService } from './company-services.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyServicesController],
  providers: [CompanyServicesService, SupabaseService],
  exports: [CompanyServicesService],
})
export class CompanyServicesModule {}
