import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminCompaniesController } from './admin-companies.controller';
import { AdminCompaniesService } from './admin-companies.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminCompaniesController],
  providers: [AdminCompaniesService],
})
export class CompaniesModule {}
