import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.config';
import { SupabaseService } from '../../config/supabase.config';
import { UserRole, ProviderType, AccountStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
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
      };

      companyAdmin?: {
        companyId: string;
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

    // Determine account status based on role
    let status: AccountStatus = AccountStatus.ACTIVE;
    if (
      data.role === UserRole.PROVIDER ||
      data.role === UserRole.COMPANY_ADMIN
    ) {
      status = AccountStatus.PENDING; // Needs admin validation
    }

    // Create user profile
    const user = await this.prisma.user.create({
      data: {
        id: userId,
        email: data.email,
        phoneNumber: data.phoneNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        status: status,
        // Persist verification state from the validated Supabase JWT payload.
        isEmailVerified: data.isEmailVerified === true,
      },
    });

    // Create role-specific details
    if (data.role === UserRole.CLIENT && data.client) {
      await this.prisma.client.create({
        data: {
          id: user.id,
          city: data.client.city,
          address: data.client.address,
          imageUrl: data.client.imageUrl,
        },
      });
    }

    if (data.role === UserRole.PROVIDER && data.provider) {
      await this.prisma.provider.create({
        data: {
          id: user.id,
          type: data.provider.type,
          city: data.provider.city,
          address: data.provider.address,
          latitude: data.provider.latitude,
          longitude: data.provider.longitude,
          photoUrl: data.provider.photoUrl,
          /*qualificationDocuments: data.providerDetails.qualificationDocuments,*/
        },
      });
    }

    if (data.role === UserRole.COMPANY_ADMIN && data.companyAdmin) {
      await this.prisma.companyAdmin.create({
        data: {
          id: user.id,
          companyId: data.companyAdmin.companyId,
        },
      });
    }

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
  async getCurrentUser(jwtUser: {
    id: string;
    email?: string | null;
  }) {
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

    return user;
  }

  async verifySupabaseToken(token: string) {
    return await this.supabase.verifyToken(token);
  }
}
