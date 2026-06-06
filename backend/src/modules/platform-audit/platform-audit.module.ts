import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { PlatformAuditService } from './platform-audit.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [PlatformAuditService],
  exports: [PlatformAuditService],
})
export class PlatformAuditModule {}
