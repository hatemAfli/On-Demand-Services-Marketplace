import { Module } from '@nestjs/common';
import { AdminFaqController } from './admin-faq.controller';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';

@Module({
  controllers: [FaqController, AdminFaqController],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
