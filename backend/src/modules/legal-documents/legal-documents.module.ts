import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminLegalDocumentsController } from './admin-legal-documents.controller';
import { LegalDocumentsController } from './legal-documents.controller';
import { LegalDocumentsService } from './legal-documents.service';

@Module({
  imports: [AuthModule],
  controllers: [LegalDocumentsController, AdminLegalDocumentsController],
  providers: [LegalDocumentsService],
  exports: [LegalDocumentsService],
})
export class LegalDocumentsModule {}
