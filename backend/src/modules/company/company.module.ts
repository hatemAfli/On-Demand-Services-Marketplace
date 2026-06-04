import { Module } from '@nestjs/common';
import { CompanyAppointmentsModule } from './appointments/company-appointments.module';
import { EmployeesModule } from './employees/employees.module';
import { CompanyScheduleModule } from './schedule/company-schedule.module';
import { CompanyReviewsModule } from './reviews/company-reviews.module';
import { CompanySettingsModule } from './settings/company-settings.module';
import { CompanyServicesModule } from './services/company-services.module';
import { CompanyComplaintsModule } from './complaints/company-complaints.module';

@Module({
  imports: [
    EmployeesModule,
    CompanyServicesModule,
    CompanyAppointmentsModule,
    CompanyScheduleModule,
    CompanyReviewsModule,
    CompanySettingsModule,
    CompanyComplaintsModule,
  ],
  exports: [
    EmployeesModule,
    CompanyServicesModule,
    CompanyAppointmentsModule,
    CompanyScheduleModule,
    CompanyReviewsModule,
    CompanySettingsModule,
    CompanyComplaintsModule,
  ],
})
export class CompanyModule {}
