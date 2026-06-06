import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../../config/prisma.module';
import { AvailabilityModule } from '../../availability/availability.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import {
  EmployeesController,
  ProviderInvitationsController,
} from './employees.controller';
import { EmployeesService } from './employees.service';
import { CompanyAuditModule } from '../audit/company-audit.module';

@Module({
  imports: [PrismaModule, AvailabilityModule, forwardRef(() => NotificationsModule), CompanyAuditModule],
  controllers: [EmployeesController, ProviderInvitationsController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
