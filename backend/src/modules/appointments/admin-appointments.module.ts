import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminAppointmentsController } from './admin-appointments.controller';
import { AdminAppointmentsService } from './admin-appointments.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [AdminAppointmentsController],
  providers: [AdminAppointmentsService],
  exports: [AdminAppointmentsService],
})
export class AdminAppointmentsModule {}
