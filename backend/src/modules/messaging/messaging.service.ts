import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageStatus, Prisma, type Conversation, type Message } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { SupabaseRealtimeService } from '../supabase/supabase-realtime.service';
import type { GetMessagesDto } from './dto/get-messages.dto';
import type { MarkConversationReadDto } from './dto/mark-read.dto';
import type { SendMessageDto } from './dto/send-message.dto';

export type MessagingRole = 'CLIENT' | 'PROVIDER';

const conversationParticipantInclude = {
  client: {
    select: {
      imageUrl: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  provider: {
    select: {
      photoUrl: true,
      tagline: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
} satisfies Prisma.ConversationInclude;

export type ConversationWithParticipants = Prisma.ConversationGetPayload<{
  include: typeof conversationParticipantInclude;
}>;

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseRealtimeService: SupabaseRealtimeService,
  ) {}

  private async assertConversationParticipant(
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (
      conversation.clientId !== userId &&
      conversation.providerId !== userId
    ) {
      throw new ForbiddenException('Access denied');
    }
    return conversation;
  }

  async openOrCreateConversation(
    requesterId: string,
    requesterRole: MessagingRole,
    counterpartId: string,
  ): Promise<ConversationWithParticipants> {
    const clientId = requesterRole === 'CLIENT' ? requesterId : counterpartId;
    const providerId = requesterRole === 'CLIENT' ? counterpartId : requesterId;

    return this.prisma.conversation.upsert({
      where: {
        clientId_providerId: { clientId, providerId },
      },
      create: { clientId, providerId },
      update: {},
      include: conversationParticipantInclude,
    });
  }

  async getMyConversations(
    userId: string,
    role: MessagingRole,
  ): Promise<ConversationWithParticipants[]> {
    const where =
      role === 'CLIENT' ? { clientId: userId } : { providerId: userId };

    return this.prisma.conversation.findMany({
      where,
      include: conversationParticipantInclude,
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
  }

  async getMessages(userId: string, dto: GetMessagesDto): Promise<Message[]> {
    await this.assertConversationParticipant(dto.conversationId, userId);

    const take = dto.take ?? 30;
    const beforeDate =
      dto.before != null && dto.before !== '' ? new Date(dto.before) : null;
    if (beforeDate != null && Number.isNaN(beforeDate.getTime())) {
      throw new BadRequestException('Invalid before cursor');
    }

    return this.prisma.message.findMany({
      where: {
        conversationId: dto.conversationId,
        ...(beforeDate
          ? {
              createdAt: {
                lt: beforeDate,
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async sendMessage(
    senderUserId: string,
    senderRole: MessagingRole,
    dto: SendMessageDto,
  ): Promise<Message> {
    const conversation = await this.assertConversationParticipant(
      dto.conversationId,
      senderUserId,
    );

    const trimmedText = dto.text?.trim() ?? '';
    const urls = this.validateChatMediaUrls(
      dto.conversationId,
      senderUserId,
      dto.mediaUrls,
    );
    if (trimmedText.length === 0 && urls.length === 0) {
      throw new BadRequestException(
        'Provide non-empty text or at least one media URL',
      );
    }

    const previewText = trimmedText.length > 0 ? trimmedText : '📷 Photo';
    const now = new Date();

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: dto.conversationId,
          senderUserId,
          senderRole,
          text: trimmedText.length > 0 ? trimmedText : null,
          mediaUrls: urls,
          status: MessageStatus.SENT,
        },
      }),
      this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: {
          lastMessageText: previewText,
          lastMessageAt: now,
          lastMessageSender: senderRole,
          ...(senderRole === 'CLIENT'
            ? { unreadProvider: { increment: 1 } }
            : { unreadClient: { increment: 1 } }),
        },
      }),
    ]);

    void this.supabaseRealtimeService.broadcastMessage(dto.conversationId, {
      id: message.id,
      conversationId: dto.conversationId,
      senderUserId,
      senderRole,
      text: dto.text ?? null,
      mediaUrls: urls,
      createdAt: message.createdAt.toISOString(),
    });

    // Unread count on conversation powers the Messages sidebar badge only — no in-app / push notification.

    return message;
  }

  async markAsRead(
    userId: string,
    role: MessagingRole,
    dto: MarkConversationReadDto,
  ): Promise<void> {
    await this.assertConversationParticipant(dto.conversationId, userId);

    const now = new Date();
    const counterpartRole: MessagingRole =
      role === 'CLIENT' ? 'PROVIDER' : 'CLIENT';

    await this.prisma.$transaction([
      this.prisma.message.updateMany({
        where: {
          conversationId: dto.conversationId,
          senderRole: counterpartRole,
          status: { not: MessageStatus.READ },
        },
        data: {
          status: MessageStatus.READ,
          readAt: now,
        },
      }),
      this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: role === 'CLIENT' ? { unreadClient: 0 } : { unreadProvider: 0 },
      }),
    ]);
  }

  /** Chat images must be in `chat-attachments`. */
  private validateChatMediaUrls(
    conversationId: string,
    senderUserId: string,
    mediaUrls?: string[],
  ): string[] {
    const urls =
      mediaUrls?.filter(
        (u) => typeof u === 'string' && u.trim().length > 0,
      ) ?? [];
    if (urls.length > 3) {
      throw new BadRequestException('Maximum 3 chat attachments per message');
    }
    const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    if (!base) return urls;

    const expectedPrefix = `${base}/storage/v1/object/public/chat-attachments/conversations/${conversationId}/${senderUserId}/`;
    for (const url of urls) {
      if (!url.startsWith(expectedPrefix)) {
        throw new BadRequestException('Invalid chat attachment URL');
      }
    }
    return urls;
  }
}
