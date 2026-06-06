import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { PlatformActivityLogsController } from './platform-activity-logs.controller';
import { PlatformActivityLogsService } from './platform-activity-logs.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformActivityLogsController],
  providers: [PlatformActivityLogsService],
})
export class PlatformActivityLogsModule {}
