import { Module } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.config';
import { GivenServiceController } from './given-service.controller';
import { GivenServicePublicController } from './given-service-public.controller';
import { GivenServiceService } from './given-service.service';

@Module({
  controllers: [GivenServiceController, GivenServicePublicController],
  providers: [GivenServiceService, SupabaseService],
  exports: [GivenServiceService],
})
export class GivenServiceModule {}

