import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../../config/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import {
  EmployeesController,
  ProviderInvitationsController,
} from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [PrismaModule, forwardRef(() => NotificationsModule)],
  controllers: [EmployeesController, ProviderInvitationsController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
