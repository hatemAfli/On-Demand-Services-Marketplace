import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  OwnerType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { UpdateAdminUserStatusDto } from './dto/update-admin-user-status.dto';

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAdminUsersQueryDto) {
    const take = query.take ?? 20;
    const skip = query.skip ?? 0;
    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phoneNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async getById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: true,
        provider: {
          include: {
            company: {
              select: {
                id: true,
                companyName: true,
                taxId: true,
                city: true,
                address: true,
                email: true,
                logo: true,
                averageRating: true,
                totalReviews: true,
              },
            },
          },
        },
        companyAdmin: {
          include: {
            company: {
              include: {
                providers: {
                  select: {
                    id: true,
                    type: true,
                    city: true,
                    photoUrl: true,
                    user: {
                      select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        platformAdmin: true,
        verificationProfilRequests: {
          orderBy: { createdAt: 'desc' },
          include: {
            service: {
              include: {
                translations: { where: { locale: 'EN' }, take: 1 },
                category: {
                  include: {
                    translations: { where: { locale: 'EN' }, take: 1 },
                  },
                },
              },
            },
            documents: {
              orderBy: { uploadedAt: 'desc' },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const stats: Record<string, number> = {};

    if (user.role === UserRole.CLIENT && user.client) {
      const [appointments, reviews, complaints] = await Promise.all([
        this.prisma.appointment.count({ where: { clientId: user.id } }),
        this.prisma.review.count({ where: { clientId: user.id } }),
        this.prisma.complaint.count({ where: { clientId: user.id } }),
      ]);
      stats.appointments = appointments;
      stats.reviews = reviews;
      stats.complaints = complaints;
    }

    if (user.role === UserRole.PROVIDER && user.provider) {
      const [appointments, reviews, complaints, givenServicesCount] =
        await Promise.all([
          this.prisma.appointment.count({ where: { providerId: user.id } }),
          this.prisma.review.count({ where: { providerId: user.id } }),
          this.prisma.complaint.count({ where: { providerId: user.id } }),
          this.prisma.givenService.count({
            where: {
              ownerType: OwnerType.PROVIDER,
              ownerId: user.id,
            },
          }),
        ]);
      stats.appointments = appointments;
      stats.reviews = reviews;
      stats.complaints = complaints;
      stats.givenServices = givenServicesCount;
    }

    let givenServices: Awaited<
      ReturnType<AdminUsersService['fetchProviderGivenServices']>
    > = [];
    if (user.role === UserRole.PROVIDER && user.provider) {
      givenServices = await this.fetchProviderGivenServices(user.id);
    }

    return {
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      stats,
      client: user.client,
      provider: user.provider
        ? {
            ...user.provider,
            averageRating: decimalToNumber(user.provider.averageRating),
            cancellationRate: decimalToNumber(user.provider.cancellationRate),
            averageResponseTime: decimalToNumber(
              user.provider.averageResponseTime,
            ),
            company: user.provider.company
              ? {
                  ...user.provider.company,
                  averageRating: decimalToNumber(
                    user.provider.company.averageRating,
                  ),
                }
              : null,
          }
        : null,
      companyAdmin: user.companyAdmin
        ? {
            ...user.companyAdmin,
            company: user.companyAdmin.company
              ? {
                  ...user.companyAdmin.company,
                  averageRating: decimalToNumber(
                    user.companyAdmin.company.averageRating,
                  ),
                  providers: user.companyAdmin.company.providers,
                }
              : null,
          }
        : null,
      platformAdmin: user.platformAdmin,
      verificationRequests: user.verificationProfilRequests.map((vr) => ({
        id: vr.id,
        ownerType: vr.ownerType,
        requestStatus: vr.requestStatus,
        adminComment: vr.adminComment,
        ownerComment: vr.ownerComment,
        createdAt: vr.createdAt,
        updatedAt: vr.updatedAt,
        service: vr.service
          ? {
              id: vr.service.id,
              name:
                vr.service.translations[0]?.name ??
                vr.service.category?.translations[0]?.name ??
                'Service',
              categorySlug: vr.service.category?.slug ?? null,
            }
          : null,
        documents: vr.documents.map((d) => ({
          id: d.id,
          type: d.type,
          fichierUrl: d.fichierUrl,
          uploadedAt: d.uploadedAt,
          validatedAt: d.validatedAt,
          isAccepted: d.isAccepted,
          rejectionReason: d.rejectionReason,
        })),
      })),
      givenServices,
    };
  }

  private async fetchProviderGivenServices(providerId: string) {
    const rows = await this.prisma.givenService.findMany({
      where: {
        ownerType: OwnerType.PROVIDER,
        ownerId: providerId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        service: {
          include: {
            translations: { where: { locale: 'EN' }, take: 1 },
            category: {
              include: {
                translations: { where: { locale: 'EN' }, take: 1 },
              },
            },
          },
        },
      },
    });

    return rows.map((gs) => ({
      id: gs.id,
      price: gs.price,
      pricingType: gs.pricingType,
      active: gs.active,
      averageRating: decimalToNumber(gs.averageRating),
      totalReviews: gs.totalReviews,
      totalCompletedJobs: gs.totalCompletedJobs,
      createdAt: gs.createdAt,
      serviceName:
        gs.service.translations[0]?.name ??
        gs.service.category?.translations[0]?.name ??
        'Service',
      categoryName: gs.service.category?.translations[0]?.name ?? null,
    }));
  }

  async updateStatus(
    targetUserId: string,
    adminUserId: string,
    dto: UpdateAdminUserStatusDto,
  ) {
    if (targetUserId === adminUserId) {
      throw new ForbiddenException('You cannot change your own account status');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.PLATFORM_ADMIN) {
      throw new ForbiddenException('Cannot modify another platform administrator');
    }

    const allowed: AccountStatus[] = [
      AccountStatus.ACTIVE,
      AccountStatus.SUSPENDED,
      AccountStatus.REJECTED,
      AccountStatus.DELETED,
      AccountStatus.PENDING,
    ];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Status ${dto.status} is not allowed via admin`);
    }

    if (user.status === AccountStatus.DELETED && dto.status !== AccountStatus.DELETED) {
      throw new BadRequestException('Deleted accounts cannot be reactivated from admin');
    }

    const now = new Date();
    const data: Prisma.UserUpdateInput = {
      status: dto.status,
      ...(dto.status === AccountStatus.DELETED
        ? { deletedAt: now }
        : dto.status === AccountStatus.ACTIVE
          ? { deletedAt: null }
          : {}),
    };

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data,
      select: {
        id: true,
        email: true,
        status: true,
        deletedAt: true,
        updatedAt: true,
      },
    });

    return {
      ...updated,
      reason: dto.reason?.trim() || null,
      message: `User status updated to ${dto.status}`,
    };
  }
}
