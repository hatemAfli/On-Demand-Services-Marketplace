import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import {
  AccountStatus,
  Locale,
  OwnerType,
  Prisma,
  ReviewStatus,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { ResendMailService } from '../../config/resend-mail.service';
import type { ListVerificationRequestsQueryDto } from './dto/list-verification-requests-query.dto';
import type { ResubmitVerificationDto } from './dto/resubmit-verification.dto';
import { GivenServiceService } from '../given-service/given-service.service';

const requestInclude = {
  user: {
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      companyAdmin: {
        select: {
          id: true,
          companyId: true,
          createdAt: true,
          company: {
            select: {
              id: true,
              companyName: true,
              taxId: true,
              logo: true,
              city: true,
              address: true,
              latitude: true,
              longitude: true,
              serviceZones: true,
              email: true,
              createdAt: true,
            },
          },
        },
      },
      provider: {
        select: {
          type: true,
          city: true,
          address: true,
          latitude: true,
          longitude: true,
          photoUrl: true,
          companyId: true,
        },
      },
    },
  },
  service: {
    select: {
      id: true,
      translations: {
        where: { locale: { in: [Locale.EN, Locale.AR] } },
        select: { locale: true, name: true },
      },
      category: {
        select: {
          slug: true,
          translations: {
            where: { locale: { in: [Locale.EN, Locale.AR] } },
            select: { locale: true, name: true },
          },
        },
      },
    },
  },
  documents: {
    select: {
      id: true,
      type: true,
      fichierUrl: true,
      uploadedAt: true,
      validatedAt: true,
    },
    orderBy: { uploadedAt: 'asc' as const },
  },
} satisfies Prisma.VerificationProfilRequestInclude;

function pickName(
  translations: { locale: Locale; name: string }[],
  fallback: string,
): string {
  return (
    translations.find((translation) => translation.locale === Locale.EN)
      ?.name ||
    translations.find((translation) => translation.locale === Locale.AR)
      ?.name ||
    translations[0]?.name ||
    fallback
  );
}

type ServiceJoin = {
  id: string;
  translations: { locale: Locale; name: string }[];
  category: {
    slug: string;
    translations: { locale: Locale; name: string }[];
  };
};

function normalizeVerificationItem<T extends { service: ServiceJoin | null }>(
  row: T,
) {
  if (!row.service) {
    return { ...row, service: null };
  }
  return {
    ...row,
    service: {
      ...row.service,
      name: pickName(row.service.translations, `service-${row.service.id}`),
      category: {
        ...row.service.category,
        name: pickName(
          row.service.category.translations,
          row.service.category.slug,
        ),
      },
    },
  };
}

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: ResendMailService,
    private readonly givenServiceService: GivenServiceService,
  ) {}

  async listVerificationRequestsForAdmin(
    _user: User,
    query: ListVerificationRequestsQueryDto,
  ) {
    const skip = query.skip ?? 0;
    const take = query.take ?? 50;

    const where: Prisma.VerificationProfilRequestWhereInput = {};
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.ownerType) {
      where.ownerType = query.ownerType;
    }
    if (query.status) {
      where.requestStatus = query.status;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.verificationProfilRequest.findMany({
        where,
        include: requestInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.verificationProfilRequest.count({ where }),
    ]);

    return {
      items: items.map(normalizeVerificationItem),
      total,
      skip,
      take,
    };
  }
  // This function is used to display the admin rejection message to the provider when he log in (account status : REJECTED)
  async getLatestVerificationRequestForCurrentUser(user: User) {
    const row = await this.prisma.verificationProfilRequest.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        requestStatus: true,
        adminComment: true,
        ownerComment: true,
        ownerType: true,
        createdAt: true,
        updatedAt: true,
        serviceId: true,
        documents: {
          select: {
            id: true,
            type: true,
            fichierUrl: true,
            uploadedAt: true,
            validatedAt: true,
          },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!row) return null;
    return row;
  }

  async getAllVerificationDocumentsForCurrentUser(user: User) {
    const rows = await this.prisma.document.findMany({
      where: { ownerUserId: user.id },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        type: true,
        fichierUrl: true,
        uploadedAt: true,
        validatedAt: true,
        verificationRequest: {
          select: {
            id: true,
            requestStatus: true,
            ownerType: true,
            createdAt: true,
            updatedAt: true,
            adminComment: true,
            ownerComment: true,
            serviceId: true,
            service: {
              select: {
                id: true,
                servicePhoto: true,
                translations: {
                  where: { locale: { in: [Locale.EN, Locale.AR] } },
                  select: { locale: true, name: true, description: true },
                },
                category: {
                  select: {
                    slug: true,
                    iconUrl: true,
                    translations: {
                      where: { locale: { in: [Locale.EN, Locale.AR] } },
                      select: { locale: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    return rows.map((row) => {
      const request = row.verificationRequest;
      if (!request?.service) {
        return row;
      }
      return {
        ...row,
        verificationRequest: {
          ...request,
          service: {
            id: request.service.id,
            servicePhoto: request.service.servicePhoto,
            name: pickName(
              request.service.translations,
              `service-${request.service.id}`,
            ),
            description:
              request.service.translations.find(
                (translation) =>
                  translation.locale === Locale.EN &&
                  Boolean(translation.description?.trim()),
              )?.description ??
              request.service.translations.find((translation) =>
                Boolean(translation.description?.trim()),
              )?.description ??
              null,
            category: request.service.category
              ? {
                  slug: request.service.category.slug,
                  iconUrl: request.service.category.iconUrl,
                  name: pickName(
                    request.service.category.translations,
                    request.service.category.slug,
                  ),
                }
              : null,
          },
        },
      };
    });
  }

  /**
   * After an admin rejection, the provider submits a new request (same service)
   * with an optional owner comment and fresh documents.
   */
  async resubmitVerificationForCurrentUser(
    user: User,
    dto: ResubmitVerificationDto,
  ) {
    if (user.status !== AccountStatus.REJECTED) {
      throw new BadRequestException(
        'You can only resubmit after your account has been rejected',
      );
    }

    const docs = dto.documents ?? [];
    if (docs.length === 0) {
      throw new BadRequestException(
        'At least one verification document is required',
      );
    }
    for (const d of docs) {
      if (!d.fichierUrl?.trim()) {
        throw new BadRequestException('Each document must include a file URL');
      }
    }

    const latestRejected =
      await this.prisma.verificationProfilRequest.findFirst({
        where: {
          userId: user.id,
          requestStatus: ReviewStatus.REJECTED,
        },
        orderBy: { createdAt: 'desc' },
      });

    if (!latestRejected) {
      throw new BadRequestException(
        'No rejected verification request found to resubmit against',
      );
    }

    const ownerComment =
      dto.ownerComment != null && String(dto.ownerComment).trim() !== ''
        ? String(dto.ownerComment).trim()
        : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const verificationRequest = await tx.verificationProfilRequest.create({
        data: {
          userId: user.id,
          ownerType: latestRejected.ownerType,
          serviceId: latestRejected.serviceId,
          requestStatus: ReviewStatus.PENDING,
          ownerComment,
        },
      });

      for (const doc of docs) {
        await tx.document.create({
          data: {
            ownerUserId: user.id,
            verificationRequestId: verificationRequest.id,
            type: doc.type,
            fichierUrl: doc.fichierUrl.trim(),
          },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: { status: AccountStatus.PENDING },
      });

      return verificationRequest;
    });

    return {
      id: created.id,
      requestStatus: created.requestStatus,
      ownerComment,
      serviceId: created.serviceId,
      createdAt: created.createdAt,
    };
  }

  async getVerificationRequestForAdmin(_user: User, id: string) {
    const row = await this.prisma.verificationProfilRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!row) {
      throw new NotFoundException('Verification request not found');
    }
    return normalizeVerificationItem(row);
  }

  async approveRequest(_user: User, id: string) {
    const existing = await this.prisma.verificationProfilRequest.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Verification request not found');
    }
    if (existing.requestStatus === ReviewStatus.APPROVED) {
      throw new BadRequestException('Request already approved');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.verificationProfilRequest.update({
        where: { id },
        data: {
          requestStatus: ReviewStatus.APPROVED,
          // adminComment is rejection-only; clear any stale value on approve.
          adminComment: null,
        },
      });
      await tx.document.updateMany({
        where: { verificationRequestId: id },
        data: { validatedAt: new Date() },
      });
      await tx.user.update({
        where: { id: existing.userId },
        data: { status: AccountStatus.ACTIVE },
      });
      if (
        existing.ownerType === OwnerType.PROVIDER &&
        existing.serviceId != null
      ) {
        await this.givenServiceService.activateForOwnerService(
          {
            ownerType: existing.ownerType,
            ownerId: existing.userId,
            serviceId: existing.serviceId,
          },
          tx,
        );
      }
      return tx.verificationProfilRequest.findUniqueOrThrow({
        where: { id },
        include: requestInclude,
      });
    });

    await this.notifyProviderOutcome(updated, 'APPROVED');

    return normalizeVerificationItem(updated);
  }

  async rejectRequest(_user: User, id: string, reason: string) {
    const existing = await this.prisma.verificationProfilRequest.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Verification request not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.verificationProfilRequest.update({
        where: { id },
        data: {
          requestStatus: ReviewStatus.REJECTED,
          adminComment: reason,
        },
      });
      await tx.user.update({
        where: { id: existing.userId },
        data: { status: AccountStatus.REJECTED },
      });
      return tx.verificationProfilRequest.findUniqueOrThrow({
        where: { id },
        include: requestInclude,
      });
    });

    await this.notifyProviderOutcome(updated, 'REJECTED', reason);

    return normalizeVerificationItem(updated);
  }

  async markUnderReview(_user: User, id: string) {
    const existing = await this.prisma.verificationProfilRequest.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Verification request not found');
    }

    const updated = await this.prisma.verificationProfilRequest.update({
      where: { id },
      data: { requestStatus: ReviewStatus.UNDER_REVIEW },
      include: requestInclude,
    });

    await this.notifyProviderOutcome(updated, 'UNDER_REVIEW');

    return normalizeVerificationItem(updated);
  }

  private async notifyProviderOutcome(
    row: {
      user: {
        email: string;
        firstName: string;
        lastName: string;
      };
    },
    status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED',
    detail?: string | null,
  ) {
    const name =
      `${row.user.firstName ?? ''} ${row.user.lastName ?? ''}`.trim() || 'User';
    await this.mail.sendVerificationOutcome({
      to: row.user.email,
      recipientName: name,
      status,
      detail: detail ?? undefined,
    });
  }
}
