import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import {
  AccountStatus,
  Locale,
  NotificationType,
  OwnerType,
  Prisma,
  ReviewStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { ResendMailService } from '../../config/resend-mail.service';
import type { ListVerificationRequestsQueryDto } from './dto/list-verification-requests-query.dto';
import type { ResubmitVerificationDto } from './dto/resubmit-verification.dto';
import type { CreateProviderServiceRequestDto } from './dto/create-provider-service-request.dto';
import type { ReviewVerificationDocumentDto } from './dto/review-verification-document.dto';
import { GivenServiceService } from '../given-service/given-service.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AvailabilityService } from '../availability/availability.service';

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
      servicePhoto: true,
      translations: {
        where: { locale: { in: [Locale.EN, Locale.AR] } },
        select: { locale: true, name: true, description: true },
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
      isAccepted: true,
      rejectionReason: true,
    },
    orderBy: { uploadedAt: 'asc' as const },
  },
} satisfies Prisma.VerificationProfilRequestInclude;

const priorDocumentSelect = {
  id: true,
  type: true,
  fichierUrl: true,
  uploadedAt: true,
  validatedAt: true,
  isAccepted: true,
  rejectionReason: true,
} as const;

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

function pickDescription(
  translations: { locale: Locale; description?: string | null }[],
): string | null {
  const en = translations.find((t) => t.locale === Locale.EN);
  const ar = translations.find((t) => t.locale === Locale.AR);

  const enDesc = en?.description?.trim();
  if (enDesc) return enDesc;

  const arDesc = ar?.description?.trim();
  if (arDesc) return arDesc;

  const firstWithDesc = translations
    .find((t) => Boolean(t.description?.trim()))
    ?.description?.trim();
  return firstWithDesc ?? null;
}

type ServiceJoin = {
  id: string;
  translations: { locale: Locale; name: string; description?: string | null }[];
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
      description: pickDescription(row.service.translations),
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
    private readonly notificationsService: NotificationsService,
    private readonly availabilityService: AvailabilityService,
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
            isAccepted: true,
            rejectionReason: true,
          },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!row) return null;
    return row;
  }

  async listVerificationRequestsForCurrentUser(user: User) {
    const rows = await this.prisma.verificationProfilRequest.findMany({
      where: { userId: user.id },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(normalizeVerificationItem);
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
        isAccepted: true,
        rejectionReason: true,
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
                givenServices: {
                  where: {
                    ownerType: OwnerType.PROVIDER,
                    ownerId: user.id,
                    active: true,
                  },
                  select: { id: true },
                  take: 1,
                },
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
            isActiveForOwner: request.service.givenServices.length > 0,
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

  async createProviderServiceRequestForCurrentUser(
    user: User,
    dto: CreateProviderServiceRequestDto,
  ) {
    if (user.role !== UserRole.PROVIDER) {
      throw new BadRequestException(
        'Only provider accounts can request a new service',
      );
    }

    const serviceId = dto.serviceId?.trim();
    if (!serviceId) {
      throw new BadRequestException('serviceId is required');
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

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, active: true },
    });
    if (!service || service.active === false) {
      throw new BadRequestException('Invalid service id');
    }

    const duplicateOpen = await this.prisma.verificationProfilRequest.findFirst(
      {
        where: {
          userId: user.id,
          ownerType: OwnerType.PROVIDER,
          serviceId,
          requestStatus: {
            in: [ReviewStatus.PENDING, ReviewStatus.UNDER_REVIEW],
          },
        },
        select: { id: true },
      },
    );
    if (duplicateOpen) {
      throw new BadRequestException(
        'You already have an open request for this service',
      );
    }

    const alreadyApproved =
      await this.prisma.verificationProfilRequest.findFirst({
        where: {
          userId: user.id,
          ownerType: OwnerType.PROVIDER,
          serviceId,
          requestStatus: ReviewStatus.APPROVED,
        },
        select: { id: true },
      });
    if (alreadyApproved) {
      throw new BadRequestException(
        'This service is already approved for your account',
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
          ownerType: OwnerType.PROVIDER,
          serviceId,
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

      await this.givenServiceService.createPendingForOwner(
        {
          ownerType: OwnerType.PROVIDER,
          ownerId: user.id,
          serviceId,
        },
        tx,
      );

      return tx.verificationProfilRequest.findUniqueOrThrow({
        where: { id: verificationRequest.id },
        include: requestInclude,
      });
    });

    return normalizeVerificationItem(created);
  }

  async getVerificationRequestForAdmin(_user: User, id: string) {
    const row = await this.prisma.verificationProfilRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!row) {
      throw new NotFoundException('Verification request not found');
    }
    const priorWhere: Prisma.VerificationProfilRequestWhereInput = {
      userId: row.userId,
      ownerType: row.ownerType,
      id: { not: row.id },
      createdAt: { lt: row.createdAt },
    };
    if (row.serviceId == null) {
      priorWhere.serviceId = null;
    } else {
      priorWhere.serviceId = row.serviceId;
    }
    const prior = await this.prisma.verificationProfilRequest.findFirst({
      where: priorWhere,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        requestStatus: true,
        createdAt: true,
        adminComment: true,
        documents: {
          select: priorDocumentSelect,
          orderBy: { uploadedAt: 'asc' },
        },
      },
    });
    return {
      ...normalizeVerificationItem(row),
      priorSubmission: prior,
    };
  }

  async reviewDocument(
    _user: User,
    requestId: string,
    documentId: string,
    dto: ReviewVerificationDocumentDto,
  ) {
    const request = await this.prisma.verificationProfilRequest.findUnique({
      where: { id: requestId },
      include: {
        documents: { select: { id: true } },
      },
    });
    if (!request) {
      throw new NotFoundException('Verification request not found');
    }
    if (
      request.requestStatus !== ReviewStatus.PENDING &&
      request.requestStatus !== ReviewStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException(
        'Documents can only be reviewed while the request is pending or under review',
      );
    }
    const belongs = request.documents.some((d) => d.id === documentId);
    if (!belongs) {
      throw new NotFoundException('Document not found on this request');
    }

    if (dto.decision === 'accept') {
      const updatedDocument = await this.prisma.document.update({
        where: { id: documentId },
        data: {
          isAccepted: true,
          validatedAt: new Date(),
          rejectionReason: null,
        },
      });
      void this.notificationsService.send({
        userId: request.userId,
        type: NotificationType.DOCUMENT_ACCEPTED,
        title: 'Document accepted ✓',
        body: `Your ${updatedDocument.type} document has been accepted by the admin`,
        data: { verificationRequestId: requestId, screen: 'ProviderRequestService' },
      });
    } else {
      const reason = dto.rejectionReason?.trim();
      if (!reason) {
        throw new BadRequestException(
          'rejectionReason is required when rejecting a document',
        );
      }
      const updatedDocument = await this.prisma.document.update({
        where: { id: documentId },
        data: {
          isAccepted: false,
          validatedAt: null,
          rejectionReason: reason,
        },
      });
      void this.notificationsService.send({
        userId: request.userId,
        type: NotificationType.DOCUMENT_REJECTED,
        title: 'Document rejected',
        body: `Your ${updatedDocument.type} was rejected. Reason: ${reason || 'See details in app'}`,
        data: { verificationRequestId: requestId, screen: 'ProviderRequestService' },
      });
    }

    const updated = await this.prisma.verificationProfilRequest.findUnique({
      where: { id: requestId },
      include: requestInclude,
    });
    if (!updated) {
      throw new NotFoundException('Verification request not found');
    }
    return normalizeVerificationItem(updated);
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

    const docs = await this.prisma.document.findMany({
      where: { verificationRequestId: id },
      select: { id: true, isAccepted: true },
    });
    if (docs.length === 0) {
      throw new BadRequestException(
        'Cannot approve a request with no documents',
      );
    }
    const allAccepted = docs.every((d) => d.isAccepted === true);
    if (!allAccepted) {
      throw new BadRequestException(
        'Every document must be individually accepted before the request can be approved. Rejected or pending files block approval.',
      );
    }

    const hadPriorApprovedProviderRequest =
      existing.ownerType === OwnerType.PROVIDER
        ? await this.prisma.verificationProfilRequest.findFirst({
            where: {
              userId: existing.userId,
              ownerType: OwnerType.PROVIDER,
              requestStatus: ReviewStatus.APPROVED,
            },
            select: { id: true },
          })
        : null;
    const shouldSeedDefaultAvailability =
      existing.ownerType === OwnerType.PROVIDER &&
      !hadPriorApprovedProviderRequest;

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

    if (shouldSeedDefaultAvailability) {
      await this.availabilityService.ensureDefaultWeeklyAvailabilityIfEmpty(
        existing.userId,
      );
    }

    void this.notificationsService.send({
      userId: existing.userId,
      type: NotificationType.ACCOUNT_VERIFIED,
      title: 'Account verified 🎉',
      body: 'Your profile has been approved. You can now receive booking requests!',
      data: { screen: 'ProviderServices' },
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
    const isProviderServiceExpansion =
      existing.ownerType === OwnerType.PROVIDER;
    const hasApprovedVerification = isProviderServiceExpansion
      ? await this.prisma.verificationProfilRequest.findFirst({
          where: {
            userId: existing.userId,
            ownerType: OwnerType.PROVIDER,
            requestStatus: ReviewStatus.APPROVED,
            id: { not: existing.id },
          },
          select: { id: true },
        })
      : null;
    // Reject profile only on initial registration flow.
    // If provider already has an approved verification, this is a new-service
    // request and account status must stay unchanged.
    const shouldRejectWholeAccount = !(
      isProviderServiceExpansion && hasApprovedVerification
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.verificationProfilRequest.update({
        where: { id },
        data: {
          requestStatus: ReviewStatus.REJECTED,
          adminComment: reason,
        },
      });
      if (shouldRejectWholeAccount) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { status: AccountStatus.REJECTED },
        });
      }
      return tx.verificationProfilRequest.findUniqueOrThrow({
        where: { id },
        include: requestInclude,
      });
    });

    void this.notificationsService.send({
      userId: existing.userId,
      type: NotificationType.ACCOUNT_REJECTED,
      title: 'Verification not approved',
      body: `Your application was not approved. ${reason || 'Please contact support for details.'}`,
      data: { screen: 'ProviderRequestService' },
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
