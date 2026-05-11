import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { AvailabilityModule } from '../availability/availability.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [PrismaModule, AvailabilityModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
