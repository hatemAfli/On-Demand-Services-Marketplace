import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { FaqService } from '../faq/faq.service';
import { ChatDto } from './dto/chat.dto';
import { CreateChatbotSessionDto } from './dto/create-chatbot-session.dto';
import { ChatbotSessionService } from './chatbot-session.service';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly sessionService: ChatbotSessionService,
    private readonly faqService: FaqService,
  ) {}

  createSession(clientId: string, dto: CreateChatbotSessionDto) {
    return this.sessionService.createSession(clientId, dto.locale ?? 'en');
  }

  listSessions(clientId: string) {
    return this.sessionService.listSessions(clientId);
  }

  getSession(sessionId: string, clientId: string) {
    return this.sessionService.getSessionWithMessages(sessionId, clientId);
  }

  deleteSession(sessionId: string, clientId: string) {
    return this.sessionService.deleteSession(sessionId, clientId).then(() => ({
      deleted: true,
    }));
  }

  async chat(dto: ChatDto, clientId: string) {
    await this.sessionService.assertSessionAccess(
      dto.sessionId,
      clientId,
      dto.locale,
    );

    await this.sessionService.appendMessage(
      dto.sessionId,
      clientId,
      'user',
      dto.message,
      dto.message,
    );

    const chatbotUrl = this.configService.get<string>('CHATBOT_URL');
    const secret = this.configService.get<string>('NESTJS_CHATBOT_SECRET');
    const started = Date.now();

    if (!chatbotUrl || !secret) {
      throw new ServiceUnavailableException('Chatbot service is not configured');
    }

    const locale = dto.locale ?? 'en';
    const [history, faq] = await Promise.all([
      this.sessionService.getLlmHistory(dto.sessionId),
      this.faqService.listPublishedForRole(UserRole.CLIENT, locale),
    ]);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${chatbotUrl.replace(/\/$/, '')}/chat`,
          {
            session_id: dto.sessionId,
            message: dto.message,
            locale,
            history: history.slice(-10),
            faq,
          },
          {
            headers: { 'X-Chatbot-Secret': secret },
            timeout: 120000,
          },
        ),
      );
      const data = response.data as {
        session_id: string;
        message: string;
        providers?: unknown[];
        suggestions?: string[];
        fallback?: boolean;
        intent_detected?: boolean;
      };

      await this.sessionService.appendMessage(
        dto.sessionId,
        clientId,
        'assistant',
        data.message,
        undefined,
        {
          providers: data.providers ?? [],
          suggestions: data.suggestions ?? [],
          fallback: Boolean(data.fallback),
          intentDetected: data.intent_detected ?? true,
          latencyMs: Date.now() - started,
        },
      );

      return data;
    } catch (err) {
      const latencyMs = Date.now() - started;
      this.logger.error('Chatbot proxy failed', err);

      await this.sessionService.appendMessage(
        dto.sessionId,
        clientId,
        'assistant',
        'Sorry, I could not process that. Please try again.',
        undefined,
        {
          fallback: true,
          intentDetected: false,
          latencyMs,
          errorCode: 'CHATBOT_PROXY_FAILED',
        },
      );

      throw new ServiceUnavailableException(
        'Unable to reach the assistant. Please try again.',
      );
    }
  }
}
