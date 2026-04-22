import { Module } from '@nestjs/common';
import { GivenServiceService } from './given-service.service';

@Module({
  providers: [GivenServiceService],
  exports: [GivenServiceService],
})
export class GivenServiceModule {}

