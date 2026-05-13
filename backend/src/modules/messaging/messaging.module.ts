import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [PrismaModule, SupabaseModule],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
