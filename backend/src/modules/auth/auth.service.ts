import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.config';
import { SupabaseService } from '../../config/supabase.config';
import {
  UserRole,
  ProviderType,
  AccountStatus,
  OwnerType,
  ReviewStatus,
  DocumentType,
} from '@prisma/client';
import { GivenServiceService } from '../given-service/given-service.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
    private readonly givenServiceService: GivenServiceService,
  ) {}

  async completeRegistration(
    userId: string,
    data: {
      email: string;
      isEmailVerified?: boolean;
      phoneNumber?: string;
      firstName: string;
      lastName: string;
      role: UserRole;

      client?: {
        city: string;
        address?: string;
        imageUrl?: string;
      };

      provider?: {
        type?: ProviderType;
        city: string;
        address?: string;
        latitude?: number;
        longitude?: number;
        photoUrl?: string;
        companyId?: string;
        /** One verification request with multiple documents + one service. */
        verification?: {
          serviceId: string;
          documents: Array<{
            type: DocumentType;
            fichierUrl: string;
          }>;
        };
      };

      companyAdmin?: {
        company: {
          companyName: string;
          taxId: string;
          city: string;
          address?: string;
          latitude?: number;
          longitude?: number;
          serviceZones?: string[];
          logo?: string;
        };
        verification: {
          documents: Array<{
            type: DocumentType;
            fichierUrl: string;
          }>;
        };
      };
    },
  ) {
    // SECURITY: prevent self-registering as platform admin
    if (data.role === UserRole.PLATFORM_ADMIN) {
      throw new BadRequestException('Invalid role selection');
    }

    // Check if user already exists in users table
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (existingUser) {
      throw new ConflictException('User profile already exists');
    }

    if (data.role === UserRole.PROVIDER && data.provider) {
      const v = data.provider.verification;
      if (
        !v?.serviceId?.trim() ||
        !Array.isArray(v.documents) ||
        v.documents.length === 0
      ) {
        throw new BadRequestException(
          'Provider registration requires a service and at least one verification document',
        );
      }
      for (const d of v.documents) {
        if (!d.fichierUrl?.trim()) {
          throw new BadRequestException(
            'Each verification document must include a file URL',
          );
        }
      }
    }

    if (data.role === UserRole.COMPANY_ADMIN && data.companyAdmin) {
      const c = data.companyAdmin.company;
      const v = data.companyAdmin.verification;
      if (!c?.companyName?.trim() || !c?.taxId?.trim() || !c?.city?.trim()) {
        throw new BadRequestException(
          'Company registration requires company name, tax ID, and city',
        );
      }
      if (!Array.isArray(v?.documents) || v.documents.length === 0) {
        throw new BadRequestException(
          'Company registration requires at least one verification document',
        );
      }
      for (const d of v!.documents) {
        if (!d.fichierUrl?.trim()) {
          throw new BadRequestException(
            'Each verification document must include a file URL',
          );
        }
      }
    }

    // Determine account status based on role
    let status: AccountStatus = AccountStatus.ACTIVE;
    if (
      data.role === UserRole.PROVIDER ||
      data.role === UserRole.COMPANY_ADMIN
    ) {
      status = AccountStatus.PENDING; // Needs admin validation
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: userId,
          email: data.email,
          phoneNumber: data.phoneNumber,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          status: status,
          isEmailVerified: data.isEmailVerified === true,
        },
      });

      if (data.role === UserRole.CLIENT && data.client) {
        await tx.client.create({
          data: {
            id: created.id,
            city: data.client.city,
            address: data.client.address,
            imageUrl: data.client.imageUrl,
          },
        });
      }

      if (data.role === UserRole.PROVIDER && data.provider) {
        await tx.provider.create({
          data: {
            id: created.id,
            type: data.provider.type ?? ProviderType.INDEPENDENT,
            city: data.provider.city,
            address: data.provider.address,
            latitude: data.provider.latitude,
            longitude: data.provider.longitude,
            photoUrl: data.provider.photoUrl,
            companyId: data.provider.companyId,
          },
        });

        const v = data.provider.verification!;
        const service = await tx.service.findUnique({
          where: { id: v.serviceId.trim() },
        });
        if (!service) {
          throw new BadRequestException('Invalid service id');
        }

        const verificationRequest = await tx.verificationProfilRequest.create({
          data: {
            userId,
            ownerType: OwnerType.PROVIDER,
            serviceId: v.serviceId.trim(),
            requestStatus: ReviewStatus.PENDING,
          },
        });

        await this.givenServiceService.createPendingForOwner(
          {
            ownerType: OwnerType.PROVIDER,
            ownerId: userId,
            serviceId: v.serviceId.trim(),
          },
          tx,
        );

        for (const doc of v.documents) {
          await tx.document.create({
            data: {
              ownerUserId: userId,
              verificationRequestId: verificationRequest.id,
              type: doc.type,
              fichierUrl: doc.fichierUrl.trim(),
            },
          });
        }
      }

      if (data.role === UserRole.COMPANY_ADMIN && data.companyAdmin) {
        const ca = data.companyAdmin;
        const comp = ca.company;
        const v = ca.verification;

        const company = await tx.company.create({
          data: {
            companyName: comp.companyName.trim(),
            taxId: comp.taxId.trim(),
            logo: comp.logo?.trim() || null,
            city: comp.city.trim(),
            address: comp.address?.trim() || null,
            latitude: comp.latitude ?? null,
            longitude: comp.longitude ?? null,
            serviceZones:
              Array.isArray(comp.serviceZones) && comp.serviceZones.length > 0
                ? comp.serviceZones.map((z) => String(z).trim()).filter(Boolean)
                : [],
            email: null,
            adminId: null,
          } as unknown as Parameters<typeof tx.company.create>[0]['data'],
        });

        await tx.companyAdmin.create({
          data: {
            id: created.id,
            companyId: company.id,
          },
        });

        await tx.company.update({
          where: { id: company.id },
          data: { adminId: created.id },
        });

        const verificationRequest = await tx.verificationProfilRequest.create({
          data: {
            userId,
            ownerType: OwnerType.COMPANY,
            serviceId: null,
            requestStatus: ReviewStatus.PENDING,
          } as unknown as Parameters<
            typeof tx.verificationProfilRequest.create
          >[0]['data'],
        });

        for (const doc of v.documents) {
          await tx.document.create({
            data: {
              ownerUserId: userId,
              verificationRequestId: verificationRequest.id,
              type: doc.type,
              fichierUrl: doc.fichierUrl.trim(),
            },
          });
        }
      }

      return created;
    });

    // Update Supabase user metadata with role
    const supabaseClient = this.supabase.getClient();
    await supabaseClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        selected_role: data.role,
        profile_completed: true,
      },
    });

    const userWithRelations = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        client: true,
        provider: true,
        companyAdmin: true,
        platformAdmin: true,
      },
    });

    return {
      user: userWithRelations ?? user,
      message:
        status === AccountStatus.PENDING
          ? 'Registration completed. Your account is pending admin validation.'
          : 'Registration completed successfully. Your account is active.',
    };
  }

  /**
   * Resolves the DB user for GET /auth/me. Pass the full object from JwtStrategy
   * so we can fall back to email when the JWT `sub` does not match `users.id`
   * (e.g. re-seeded DB vs existing Supabase user).
   */
  async getCurrentUser(jwtUser: { id: string; email?: string | null }) {
    const include = {
      client: true,
      provider: true,
      companyAdmin: true,
      platformAdmin: true,
    } as const;

    let user = await this.prisma.user.findUnique({
      where: { id: jwtUser.id },
      include,
    });

    if (!user && jwtUser.email) {
      user = await this.prisma.user.findUnique({
        where: { email: jwtUser.email },
        include,
      });
    }

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const normalizedJwtEmail = jwtUser.email?.trim().toLowerCase();
    if (normalizedJwtEmail && normalizedJwtEmail !== user.email) {
      const emailOwner = await this.prisma.user.findUnique({
        where: { email: normalizedJwtEmail },
        select: { id: true },
      });

      if (emailOwner && emailOwner.id !== user.id) {
        throw new ConflictException('Email already in use by another account');
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { email: normalizedJwtEmail },
        include,
      });
    }

    return user;
  }

  async verifySupabaseToken(token: string) {
    return await this.supabase.verifyToken(token);
  }

  async lookupMagicLoginAccount(data: { email: string }) {
    const normalizedEmail = data.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    return { exists: Boolean(existingUser) };
  }

  async checkEmailChangeAvailability(userId: string, data: { email: string }) {
    const normalizedEmail = data.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!currentUser) {
      throw new BadRequestException('User not found');
    }

    if (normalizedEmail === currentUser.email) {
      throw new BadRequestException('Please enter a different email address');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Email already in use by another account');
    }

    return { available: true };
  }
}
