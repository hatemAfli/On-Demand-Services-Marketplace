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
import type { MarkMessagesDeliveredDto } from './dto/mark-delivered.dto';
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

  private messageToBroadcastPayload(message: Message): Record<string, unknown> {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      senderRole: message.senderRole,
      text: message.text,
      mediaUrls: message.mediaUrls,
      status: message.status,
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt?.toISOString() ?? null,
      deletedAt: message.deletedAt?.toISOString() ?? null,
    };
  }

  private async broadcastMessageStatus(
    conversationId: string,
    messageIds: string[],
    status: MessageStatus,
  ): Promise<void> {
    if (messageIds.length === 0) return;
    void this.supabaseRealtimeService.broadcastConversationEvent(
      conversationId,
      'messages_status',
      { messageIds, status },
    );
  }

  private async refreshConversationPreview(conversationId: string): Promise<void> {
    const latest = await this.prisma.message.findFirst({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) return;

    const previewText =
      latest.text?.trim() ||
      (latest.mediaUrls.length > 0 ? '📷 Photo' : 'Message withdrawn');

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageText: previewText,
        lastMessageAt: latest.createdAt,
        lastMessageSender: latest.senderRole,
      },
    });
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

    void this.supabaseRealtimeService.broadcastMessage(
      dto.conversationId,
      this.messageToBroadcastPayload(message),
    );

    // Unread count on conversation powers the Messages sidebar badge only — no in-app / push notification.

    return message;
  }

  async markDelivered(
    userId: string,
    dto: MarkMessagesDeliveredDto,
  ): Promise<void> {
    await this.assertConversationParticipant(dto.conversationId, userId);

    const toDeliver = await this.prisma.message.findMany({
      where: {
        id: { in: dto.messageIds },
        conversationId: dto.conversationId,
        senderUserId: { not: userId },
        status: MessageStatus.SENT,
        deletedAt: null,
      },
      select: { id: true },
    });
    const ids = toDeliver.map((m) => m.id);
    if (ids.length === 0) return;

    await this.prisma.message.updateMany({
      where: { id: { in: ids } },
      data: { status: MessageStatus.DELIVERED },
    });

    void this.broadcastMessageStatus(
      dto.conversationId,
      ids,
      MessageStatus.DELIVERED,
    );
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

    const toRead = await this.prisma.message.findMany({
      where: {
        conversationId: dto.conversationId,
        senderRole: counterpartRole,
        status: { not: MessageStatus.READ },
        deletedAt: null,
      },
      select: { id: true },
    });
    const ids = toRead.map((m) => m.id);
    if (ids.length === 0) {
      await this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: role === 'CLIENT' ? { unreadClient: 0 } : { unreadProvider: 0 },
      });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.message.updateMany({
        where: { id: { in: ids } },
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

    void this.broadcastMessageStatus(
      dto.conversationId,
      ids,
      MessageStatus.READ,
    );
  }

  async updateMessage(
    userId: string,
    messageId: string,
    text: string,
  ): Promise<Message> {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Message text cannot be empty');
    }

    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!existing) {
      throw new NotFoundException('Message not found');
    }
    await this.assertConversationParticipant(
      existing.conversationId,
      userId,
    );
    if (existing.senderUserId !== userId) {
      throw new ForbiddenException('Only the sender can edit this message');
    }
    if (existing.deletedAt != null) {
      throw new BadRequestException('Cannot edit a withdrawn message');
    }

    const now = new Date();
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        text: trimmed,
        editedAt: now,
      },
    });

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: existing.conversationId },
      select: { lastMessageAt: true },
    });
    if (
      conversation?.lastMessageAt &&
      existing.createdAt.getTime() >= conversation.lastMessageAt.getTime()
    ) {
      await this.prisma.conversation.update({
        where: { id: existing.conversationId },
        data: { lastMessageText: trimmed },
      });
    }

    void this.supabaseRealtimeService.broadcastConversationEvent(
      existing.conversationId,
      'message_updated',
      this.messageToBroadcastPayload(updated),
    );

    return updated;
  }

  async withdrawMessage(userId: string, messageId: string): Promise<Message> {
    const existing = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!existing) {
      throw new NotFoundException('Message not found');
    }
    await this.assertConversationParticipant(
      existing.conversationId,
      userId,
    );
    if (existing.senderUserId !== userId) {
      throw new ForbiddenException('Only the sender can withdraw this message');
    }
    if (existing.deletedAt != null) {
      throw new BadRequestException('Message already withdrawn');
    }

    const now = new Date();
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: now,
        text: null,
        mediaUrls: [],
      },
    });

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: existing.conversationId },
      select: { lastMessageAt: true },
    });
    if (
      conversation?.lastMessageAt &&
      existing.createdAt.getTime() >= conversation.lastMessageAt.getTime()
    ) {
      await this.refreshConversationPreview(existing.conversationId);
    }

    void this.supabaseRealtimeService.broadcastConversationEvent(
      existing.conversationId,
      'message_withdrawn',
      {
        id: updated.id,
        conversationId: updated.conversationId,
        deletedAt: updated.deletedAt?.toISOString() ?? null,
      },
    );

    return updated;
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
