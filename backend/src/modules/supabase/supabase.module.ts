import { Module } from '@nestjs/common';
import { SupabaseRealtimeService } from './supabase-realtime.service';

@Module({
  providers: [SupabaseRealtimeService],
  exports: [SupabaseRealtimeService],
})
export class SupabaseModule {}
