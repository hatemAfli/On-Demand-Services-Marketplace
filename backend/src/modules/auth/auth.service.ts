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
      phoneNumber?: string;
      firstName: string;
      lastName: string;
      role: UserRole;

      client?: {
        city: string;
        address?: string;
        latitude?: number;
        longitude?: number;
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
        isEmailVerified: false, // Will be updated by Supabase webhook
      },
    });

    // Create role-specific details
    if (data.role === UserRole.CLIENT && data.client) {
      await this.prisma.client.create({
        data: {
          id: user.id,
          city: data.client.city,
          address: data.client.address,
          latitude: data.client.latitude,
          longitude: data.client.longitude,
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

    return {
      user,
      message:
        status === AccountStatus.PENDING
          ? 'Registration completed. Your account is pending admin validation.'
          : 'Registration completed successfully. Your account is active.',
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: true,
        provider: true,
        companyAdmin: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  async verifySupabaseToken(token: string) {
    return await this.supabase.verifyToken(token);
  }
}
