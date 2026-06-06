import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupportMessageStatus, UserRole, PlatformAuditAction } from '@prisma/client';
import type { User } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import type { PlatformAuditContext } from '../platform-audit/platform-audit.types';
import {
  CreateSupportMessageDto,
  ListAdminSupportMessagesQueryDto,
} from './dto/support-message.dto';

@Injectable()
export class SupportMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  async createForUser(user: User, dto: CreateSupportMessageDto) {
    if (user.role !== UserRole.CLIENT && user.role !== UserRole.PROVIDER) {
      throw new BadRequestException(
        'Only clients and providers can contact support',
      );
    }

    return this.prisma.supportMessage.create({
      data: {
        userId: user.id,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        userRole: user.role,
        status: SupportMessageStatus.NEW,
      },
    });
  }

  listForAdmin(query: ListAdminSupportMessagesQueryDto) {
    const search = query.search?.trim();
    return this.prisma.supportMessage.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } },
                { message: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getForAdmin(id: string) {
    const row = await this.prisma.supportMessage.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            role: true,
            status: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Support message not found');
    return row;
  }

  async updateStatus(
    id: string,
    status: SupportMessageStatus,
    ctx?: PlatformAuditContext,
  ) {
    const existing = await this.prisma.supportMessage.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Support message not found');

    const updated = await this.prisma.supportMessage.update({
      where: { id },
      data: {
        status,
        readAt:
          status === SupportMessageStatus.NEW
            ? null
            : existing.readAt ?? new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    const actor = ctx
      ? await this.audit.actorName(ctx.actorAdminId)
      : 'Admin';
    this.audit.logIf(
      ctx,
      PlatformAuditAction.SUPPORT_MESSAGE_STATUS_UPDATED,
      `${actor} changed support message status from ${existing.status} to ${status}.`,
      { messageId: id, previousStatus: existing.status, newStatus: status },
    );

    return updated;
  }

  countNew() {
    return this.prisma.supportMessage.count({
      where: { status: SupportMessageStatus.NEW },
    });
  }
}
