import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../config/prisma.module';
import { AvailabilityModule } from '../../availability/availability.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { SupabaseModule } from '../../supabase/supabase.module';
import { CompanyAuditModule } from '../audit/company-audit.module';
import { CompanyAppointmentsController } from './company-appointments.controller';
import { CompanyAppointmentsService } from './company-appointments.service';

@Module({
  imports: [
    PrismaModule,
    AvailabilityModule,
    NotificationsModule,
    SupabaseModule,
    CompanyAuditModule,
  ],
  controllers: [CompanyAppointmentsController],
  providers: [CompanyAppointmentsService],
  exports: [CompanyAppointmentsService],
})
export class CompanyAppointmentsModule {}
