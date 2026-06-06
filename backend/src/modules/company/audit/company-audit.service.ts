import { Injectable } from '@nestjs/common';
import { CompanyAuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma.config';

@Injectable()
export class CompanyAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async actorFirstName(actorAdminId: string): Promise<string> {
    const admin = await this.prisma.companyAdmin.findUnique({
      where: { id: actorAdminId },
      select: { user: { select: { firstName: true } } },
    });
    return admin?.user?.firstName?.trim() || 'Admin';
  }

  async log(
    companyId: string,
    actorAdminId: string,
    action: CompanyAuditAction,
    summary: string,
    metadata?: Prisma.InputJsonValue,
    ipAddress?: string,
  ): Promise<void> {
    await this.prisma.companyAuditLog.create({
      data: {
        companyId,
        actorAdminId,
        action,
        summary,
        metadata,
        ipAddress,
      },
    });
  }
}
