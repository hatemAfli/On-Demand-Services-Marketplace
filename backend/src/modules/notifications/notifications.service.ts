import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Prisma, type Notification, type NotificationType } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../config/prisma.config';
import { MarkNotificationsReadDto } from './dto/mark-read.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

interface SendNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  async registerPushToken(userId: string, dto: RegisterPushTokenDto): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { userId_token: { userId, token: dto.token } },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { updatedAt: new Date() },
    });
  }

  async unregisterPushToken(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({
      where: {
        userId,
        token,
      },
    });
  }

  async getUserTokens(userId: string): Promise<string[]> {
    const rows = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }

  async getMyNotifications(userId: string, skip = 0, take = 30): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async markAsRead(userId: string, dto: MarkNotificationsReadDto): Promise<void> {
    const ids = dto.ids?.filter(Boolean) ?? [];
    if (ids.length > 0) {
      await this.prisma.notification.updateMany({
        where: {
          userId,
          id: { in: ids },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
      return;
    }

    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async send(payload: SendNotificationPayload): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data
          ? (payload.data as Prisma.InputJsonObject)
          : Prisma.JsonNull,
        isRead: false,
      },
    });

    const tokens = await this.getUserTokens(payload.userId);
    if (tokens.length === 0) return;

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      priority: 'high' as const,
    }));

    try {
      await firstValueFrom(
        this.httpService.post(
          'https://exp.host/--/api/v2/push/send',
          JSON.stringify(messages),
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'Accept-Encoding': 'gzip, deflate',
            },
          },
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to send Expo push notification for user ${payload.userId}: ${message}`,
        stack,
      );
    }
  }

  async sendToMany(
    userIds: string[],
    payload: Omit<SendNotificationPayload, 'userId'>,
  ): Promise<void> {
    await Promise.allSettled(userIds.map((userId) => this.send({ ...payload, userId })));
  }
}
