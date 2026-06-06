import { Injectable } from '@nestjs/common';
import { PlatformAuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import type { PlatformAuditContext } from '../platform-audit/platform-audit.types';
import { ListPlatformActivityLogsDto } from './dto/list-platform-activity-logs.dto';

@Injectable()
export class PlatformActivityLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  async list(dto: ListPlatformActivityLogsDto) {
    const take = dto.take ?? 20;
    const skip = dto.skip ?? 0;
    const search = dto.search?.trim();

    const where: Prisma.PlatformAuditLogWhereInput = {
      ...(dto.action ? { action: dto.action } : {}),
      ...(search
        ? { summary: { contains: search, mode: 'insensitive' } }
        : {}),
    };

    if (dto.from || dto.to) {
      where.createdAt = {};
      if (dto.from) {
        where.createdAt.gte = new Date(`${dto.from}T00:00:00.000Z`);
      }
      if (dto.to) {
        where.createdAt.lte = new Date(`${dto.to}T23:59:59.999Z`);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          actorAdmin: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.platformAuditLog.count({ where }),
    ]);

    return { items: items.map((log) => this.mapLog(log)), total, skip, take };
  }

  async getStats() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const [total, today, thisWeek] = await Promise.all([
      this.prisma.platformAuditLog.count(),
      this.prisma.platformAuditLog.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      this.prisma.platformAuditLog.count({
        where: { createdAt: { gte: startOfWeek } },
      }),
    ]);

    return { total, today, thisWeek };
  }

  async exportCsv(ctx: PlatformAuditContext): Promise<string> {
    const logs = await this.prisma.platformAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        actorAdmin: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const header = 'Log ID,Action,Summary,Actor,IP Address,Created At';
    const lines = logs.map((log) => {
      const mapped = this.mapLog(log);
      return [
        mapped.displayId,
        mapped.action,
        mapped.summary,
        mapped.actorName,
        mapped.ipAddress ?? '',
        mapped.createdAt.toISOString(),
      ]
        .map((v) => this.csvEscape(v))
        .join(',');
    });

    const actor = await this.audit.actorName(ctx.actorAdminId);
    this.audit.logIf(
      ctx,
      PlatformAuditAction.DATA_EXPORT,
      `${actor} exported platform activity logs.`,
      { type: 'activity-logs' },
    );

    return [header, ...lines].join('\n');
  }

  private mapLog(log: {
    id: string;
    action: PlatformAuditAction;
    summary: string;
    ipAddress: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    actorAdmin: {
      user: { firstName: string; lastName: string };
    } | null;
  }) {
    const actorName = log.actorAdmin?.user
      ? `${log.actorAdmin.user.firstName ?? ''} ${log.actorAdmin.user.lastName ?? ''}`.trim()
      : 'System';
    return {
      id: log.id,
      action: log.action,
      summary: log.summary,
      actorName: actorName || 'System',
      ipAddress: log.ipAddress,
      metadata: log.metadata,
      createdAt: log.createdAt,
      displayId: `#LOG-${log.id.slice(0, 8).toUpperCase()}`,
    };
  }

  private csvEscape(value: unknown): string {
    const str = value == null ? '' : String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }
}
