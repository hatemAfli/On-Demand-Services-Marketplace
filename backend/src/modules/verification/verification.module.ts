import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ResendMailService } from '../../config/resend-mail.service';
import { AdminVerificationController } from './admin-verification.controller';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { GivenServiceModule } from '../given-service/given-service.module';

@Module({
  imports: [AuthModule, GivenServiceModule],
  controllers: [AdminVerificationController, VerificationController],
  providers: [VerificationService, ResendMailService],
  exports: [VerificationService],
})
export class VerificationModule {}
