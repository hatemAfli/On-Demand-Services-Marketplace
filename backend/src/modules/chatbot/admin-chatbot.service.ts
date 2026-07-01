import { Injectable } from '@nestjs/common';
import { ChatbotMessageRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { ListAdminChatbotSessionsDto } from './dto/list-admin-chatbot-sessions.dto';

export type AdminChatbotSessionStats = {
  totalSessions: number;
  totalMessages: number;
  sessionsLast24h: number;
  messagesLast24h: number;
  fallbackRatePercent: number;
  avgMessagesPerSession: number;
  errorCount: number;
};

export type AdminChatbotSessionListItem = {
  sessionId: string;
  title: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  fallbackCount: number;
  deletedAt: string | null;
  client: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    city: string | null;
  };
};

@Injectable()
export class AdminChatbotService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminChatbotSessionStats> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalSessions,
      totalMessages,
      sessionsLast24h,
      messagesLast24h,
      assistantTotal,
      assistantFallback,
      errorCount,
    ] = await Promise.all([
      this.prisma.chatbotSession.count(),
      this.prisma.chatbotMessage.count(),
      this.prisma.chatbotSession.count({ where: { createdAt: { gte: since } } }),
      this.prisma.chatbotMessage.count({ where: { createdAt: { gte: since } } }),
      this.prisma.chatbotMessage.count({
        where: { role: ChatbotMessageRole.ASSISTANT },
      }),
      this.prisma.chatbotMessage.count({
        where: { role: ChatbotMessageRole.ASSISTANT, fallback: true },
      }),
      this.prisma.chatbotMessage.count({
        where: { errorCode: { not: null } },
      }),
    ]);

    return {
      totalSessions,
      totalMessages,
      sessionsLast24h,
      messagesLast24h,
      fallbackRatePercent:
        assistantTotal > 0
          ? Math.round((assistantFallback / assistantTotal) * 1000) / 10
          : 0,
      avgMessagesPerSession:
        totalSessions > 0
          ? Math.round((totalMessages / totalSessions) * 10) / 10
          : 0,
      errorCount,
    };
  }

  async listSessions(dto: ListAdminChatbotSessionsDto) {
    const take = dto.take ?? 20;
    const skip = dto.skip ?? 0;
    const where: Prisma.ChatbotSessionWhereInput = {};

    if (dto.clientId?.trim()) where.clientId = dto.clientId.trim();
    if (dto.locale?.trim()) where.locale = dto.locale.trim();
    if (dto.from || dto.to) {
      where.updatedAt = {
        ...(dto.from ? { gte: new Date(dto.from) } : {}),
        ...(dto.to ? { lte: new Date(dto.to) } : {}),
      };
    }
    if (dto.includeDeleted !== true) where.deletedAt = null;
    if (dto.search?.trim()) {
      const q = dto.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        {
          client: {
            user: {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }
    if (dto.hasFallback === true) {
      where.messages = {
        some: { role: ChatbotMessageRole.ASSISTANT, fallback: true },
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.chatbotSession.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: {
          client: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          messages: {
            where: { role: ChatbotMessageRole.ASSISTANT, fallback: true },
            select: { id: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.chatbotSession.count({ where }),
    ]);

    const items: AdminChatbotSessionListItem[] = rows.map((row) => ({
      sessionId: row.id,
      title: row.title.trim() || 'New conversation',
      locale: row.locale,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      messageCount: row._count.messages,
      fallbackCount: row.messages.length,
      client: {
        id: row.client.user.id,
        email: row.client.user.email,
        firstName: row.client.user.firstName,
        lastName: row.client.user.lastName,
        city: row.client.city,
      },
    }));

    return {
      items,
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
    };
  }

  async getSessionDetail(sessionId: string) {
    const row = await this.prisma.chatbotSession.findUnique({
      where: { id: sessionId },
      include: {
        client: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!row) return null;

    return {
      session: {
        sessionId: row.id,
        title: row.title.trim() || 'New conversation',
        locale: row.locale,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        deletedAt: row.deletedAt?.toISOString() ?? null,
      },
      client: {
        id: row.client.user.id,
        email: row.client.user.email,
        firstName: row.client.user.firstName,
        lastName: row.client.user.lastName,
        phoneNumber: row.client.user.phoneNumber,
        city: row.client.city,
      },
      messages: row.messages.map((m) => ({
        id: m.id,
        role: m.role === ChatbotMessageRole.USER ? 'user' : 'assistant',
        text: m.text,
        createdAt: m.createdAt.toISOString(),
        providers: Array.isArray(m.providers) ? m.providers : [],
        suggestions: Array.isArray(m.suggestions) ? m.suggestions : [],
        fallback: m.fallback,
        intentDetected: m.intentDetected,
        latencyMs: m.latencyMs,
        errorCode: m.errorCode,
      })),
    };
  }
}
