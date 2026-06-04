import { Module } from '@nestjs/common';
import { AdminSupportMessagesController } from './admin-support-messages.controller';
import { SupportMessagesController } from './support-messages.controller';
import { SupportMessagesService } from './support-messages.service';

@Module({
  controllers: [SupportMessagesController, AdminSupportMessagesController],
  providers: [SupportMessagesService],
  exports: [SupportMessagesService],
})
export class SupportMessagesModule {}
