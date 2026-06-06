import { Injectable } from '@nestjs/common';
import { PlatformAuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import type { PlatformAuditContext } from './platform-audit.types';

@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async actorName(actorAdminId: string): Promise<string> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: actorAdminId },
      select: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!admin?.user) return 'Admin';
    const name =
      `${admin.user.firstName ?? ''} ${admin.user.lastName ?? ''}`.trim();
    return name || 'Admin';
  }

  async log(
    actorAdminId: string,
    action: PlatformAuditAction,
    summary: string,
    metadata?: Prisma.InputJsonValue,
    ipAddress?: string,
  ): Promise<void> {
    await this.prisma.platformAuditLog.create({
      data: {
        actorAdminId,
        action,
        summary,
        metadata,
        ipAddress,
      },
    });
  }

  logIf(
    ctx: PlatformAuditContext | undefined,
    action: PlatformAuditAction,
    summary: string,
    metadata?: Prisma.InputJsonValue,
  ): void {
    if (!ctx?.actorAdminId) return;
    void this.log(
      ctx.actorAdminId,
      action,
      summary,
      metadata,
      ctx.ipAddress,
    ).catch(() => undefined);
  }
}
