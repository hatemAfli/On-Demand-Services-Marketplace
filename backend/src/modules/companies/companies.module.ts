import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminCompaniesController } from './admin-companies.controller';
import { AdminCompaniesService } from './admin-companies.service';
import { CompaniesPublicController } from './companies-public.controller';
import { CompaniesPublicService } from './companies-public.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminCompaniesController, CompaniesPublicController],
  providers: [AdminCompaniesService, CompaniesPublicService],
})
export class CompaniesModule {}
