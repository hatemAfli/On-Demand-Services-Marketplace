import { Module } from '@nestjs/common';
import { GivenServiceController } from './given-service.controller';
import { GivenServiceService } from './given-service.service';

@Module({
  controllers: [GivenServiceController],
  providers: [GivenServiceService],
  exports: [GivenServiceService],
})
export class GivenServiceModule {}

