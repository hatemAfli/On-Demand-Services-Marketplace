import { PlatformAuditAction, Prisma } from '@prisma/client';

export type PlatformAuditContext = {
  actorAdminId: string;
  ipAddress?: string;
};

export { PlatformAuditAction };
export type { Prisma };
