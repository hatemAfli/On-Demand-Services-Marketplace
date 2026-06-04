import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../config/prisma.module';
import { AvailabilityModule } from '../../availability/availability.module';
import { CompanyScheduleController } from './company-schedule.controller';
import { CompanyScheduleService } from './company-schedule.service';

@Module({
  imports: [PrismaModule, AvailabilityModule],
  controllers: [CompanyScheduleController],
  providers: [CompanyScheduleService],
  exports: [CompanyScheduleService],
})
export class CompanyScheduleModule {}
