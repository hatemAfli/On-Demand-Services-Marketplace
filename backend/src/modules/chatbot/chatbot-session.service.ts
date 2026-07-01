import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatbotMessageRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';

export type ChatbotSessionMeta = {
  sessionId: string;
  clientId: string;
  title: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatbotStoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  providers?: unknown[];
  suggestions?: string[];
  fallback?: boolean;
  intentDetected?: boolean;
  latencyMs?: number | null;
  errorCode?: string | null;
};

export type ChatbotSessionSummary = {
  sessionId: string;
  title: string;
  locale: string;
  updatedAt: string;
  messageCount: number;
  fallbackCount?: number;
};

export type AppendMessageOptions = {
  providers?: unknown[];
  suggestions?: string[];
  fallback?: boolean;
  intentDetected?: boolean;
  latencyMs?: number;
  errorCode?: string;
};

@Injectable()
export class ChatbotSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    clientId: string,
    locale = 'en',
    sessionId?: string,
  ): Promise<ChatbotSessionMeta> {
    const row = await this.prisma.chatbotSession.create({
      data: {
        ...(sessionId ? { id: sessionId } : {}),
        clientId,
        locale: locale.slice(0, 10),
        title: '',
      },
    });
    return this.toMeta(row);
  }

  async getSessionMeta(sessionId: string): Promise<ChatbotSessionMeta | null> {
    const row = await this.prisma.chatbotSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });
    return row ? this.toMeta(row) : null;
  }

  async assertSessionAccess(
    sessionId: string,
    clientId: string,
    locale?: string,
  ): Promise<ChatbotSessionMeta> {
    const row = await this.prisma.chatbotSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });
    if (!row) {
      return this.createSession(clientId, locale ?? 'en', sessionId);
    }
    if (row.clientId !== clientId) {
      throw new ForbiddenException('This chat session belongs to another user');
    }
    return this.toMeta(row);
  }

  async listSessions(clientId: string): Promise<ChatbotSessionSummary[]> {
    const rows = await this.prisma.chatbotSession.findMany({
      where: { clientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: { select: { messages: true } },
        messages: {
          where: { role: ChatbotMessageRole.ASSISTANT, fallback: true },
          select: { id: true },
        },
      },
    });
    return rows.map((row) => ({
      sessionId: row.id,
      title: row.title.trim() || 'New conversation',
      locale: row.locale,
      updatedAt: row.updatedAt.toISOString(),
      messageCount: row._count.messages,
      fallbackCount: row.messages.length,
    }));
  }

  async getSessionWithMessages(
    sessionId: string,
    clientId: string,
  ): Promise<{ session: ChatbotSessionMeta; messages: ChatbotStoredMessage[] }> {
    const row = await this.prisma.chatbotSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) {
      throw new NotFoundException('Chat session not found');
    }
    if (row.clientId !== clientId) {
      throw new ForbiddenException('This chat session belongs to another user');
    }
    return {
      session: this.toMeta(row),
      messages: row.messages.map((m) => this.toStoredMessage(m)),
    };
  }

  async getMessages(sessionId: string): Promise<ChatbotStoredMessage[]> {
    const rows = await this.prisma.chatbotMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => this.toStoredMessage(m));
  }

  /** Last N turns for Python intent extraction. */
  async getLlmHistory(
    sessionId: string,
    limit = 10,
  ): Promise<Array<{ role: string; content: string }>> {
    const rows = await this.prisma.chatbotMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { role: true, text: true },
    });
    return rows.reverse().map((m) => ({
      role: m.role === ChatbotMessageRole.USER ? 'user' : 'assistant',
      content: m.text,
    }));
  }

  async appendMessage(
    sessionId: string,
    clientId: string,
    role: 'user' | 'assistant',
    text: string,
    userTextForTitle?: string,
    options?: AppendMessageOptions,
  ): Promise<ChatbotStoredMessage> {
    const meta = await this.assertSessionAccess(sessionId, clientId);
    const title =
      meta.title ||
      (userTextForTitle
        ? userTextForTitle.trim().slice(0, 80)
        : text.trim().slice(0, 80));

    const [message] = await this.prisma.$transaction([
      this.prisma.chatbotMessage.create({
        data: {
          sessionId,
          role:
            role === 'user'
              ? ChatbotMessageRole.USER
              : ChatbotMessageRole.ASSISTANT,
          text,
          providers: (options?.providers ?? []) as Prisma.InputJsonValue,
          suggestions: (options?.suggestions ?? []) as Prisma.InputJsonValue,
          fallback: options?.fallback ?? false,
          intentDetected: options?.intentDetected,
          latencyMs: options?.latencyMs,
          errorCode: options?.errorCode,
        },
      }),
      this.prisma.chatbotSession.update({
        where: { id: sessionId },
        data: {
          updatedAt: new Date(),
          ...(title && !meta.title ? { title } : {}),
        },
      }),
    ]);

    return this.toStoredMessage(message);
  }

  async deleteSession(sessionId: string, clientId: string): Promise<void> {
    const row = await this.prisma.chatbotSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });
    if (!row) return;
    if (row.clientId !== clientId) {
      throw new ForbiddenException('This chat session belongs to another user');
    }
    await this.prisma.chatbotSession.update({
      where: { id: sessionId },
      data: { deletedAt: new Date() },
    });
  }

  private toMeta(row: {
    id: string;
    clientId: string;
    title: string;
    locale: string;
    createdAt: Date;
    updatedAt: Date;
  }): ChatbotSessionMeta {
    return {
      sessionId: row.id,
      clientId: row.clientId,
      title: row.title,
      locale: row.locale,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toStoredMessage(row: {
    id: string;
    role: ChatbotMessageRole;
    text: string;
    createdAt: Date;
    providers: unknown;
    suggestions: unknown;
    fallback: boolean;
    intentDetected: boolean | null;
    latencyMs: number | null;
    errorCode: string | null;
  }): ChatbotStoredMessage {
    return {
      id: row.id,
      role: row.role === ChatbotMessageRole.USER ? 'user' : 'assistant',
      text: row.text,
      createdAt: row.createdAt.toISOString(),
      providers: Array.isArray(row.providers) ? row.providers : [],
      suggestions: Array.isArray(row.suggestions)
        ? (row.suggestions as string[])
        : [],
      fallback: row.fallback,
      intentDetected: row.intentDetected ?? undefined,
      latencyMs: row.latencyMs,
      errorCode: row.errorCode,
    };
  }
}
