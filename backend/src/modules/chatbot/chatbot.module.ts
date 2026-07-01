import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../config/prisma.module';
import { FaqModule } from '../faq/faq.module';
import { SearchModule } from '../search/search.module';
import { ChatbotSecretGuard } from '../../common/guards/chatbot-secret.guard';
import { AdminChatbotController } from './admin-chatbot.controller';
import { AdminChatbotService } from './admin-chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotSessionService } from './chatbot-session.service';

@Module({
  imports: [HttpModule, SearchModule, PrismaModule, FaqModule],
  controllers: [ChatbotController, AdminChatbotController],
  providers: [
    ChatbotService,
    ChatbotSessionService,
    AdminChatbotService,
    ChatbotSecretGuard,
  ],
})
export class ChatbotModule {}
