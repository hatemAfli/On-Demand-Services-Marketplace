import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ResendMailService } from '../../config/resend-mail.service';
import { AdminVerificationController } from './admin-verification.controller';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { GivenServiceModule } from '../given-service/given-service.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [AuthModule, GivenServiceModule, NotificationsModule, AvailabilityModule],
  controllers: [AdminVerificationController, VerificationController],
  providers: [VerificationService, ResendMailService],
  exports: [VerificationService],
})
export class VerificationModule {}
