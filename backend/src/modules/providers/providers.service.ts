import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { SupabaseService } from '../../config/supabase.config';
import { UserAccountService } from '../accounts/user-account.service';
import { UpdateUserIdentityDto } from '../accounts/dto/update-user-identity.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';

@Injectable()
export class ProvidersService {
  constructor(
    private prisma: PrismaService,
    private userAccount: UserAccountService,
    private supabase: SupabaseService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException(
        'Provider profile not found. Complete registration first.',
      );
    }

    if (user.role !== UserRole.PROVIDER) {
      throw new BadRequestException('Not a provider account');
    }

    return user;
  }

  async updateMe(userId: string, dto: UpdateProviderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.PROVIDER) {
      throw new BadRequestException('Not a provider account');
    }
    if (!user.provider) {
      throw new NotFoundException(
        'Provider profile not found. Complete registration first.',
      );
    }

    const userUpdateData = this.userAccount.buildUserUpdateData(
      dto as UpdateUserIdentityDto,
    );
    const providerUpdateData: Prisma.ProviderUpdateInput = {};

    if (dto.city !== undefined) providerUpdateData.city = dto.city;
    if (dto.address !== undefined) providerUpdateData.address = dto.address;
    if (dto.latitude !== undefined) providerUpdateData.latitude = dto.latitude;
    if (dto.longitude !== undefined) providerUpdateData.longitude = dto.longitude;
    if (dto.photoUrl !== undefined) providerUpdateData.photoUrl = dto.photoUrl;
    if (dto.tagline !== undefined) providerUpdateData.tagline = dto.tagline;
    if (dto.bio !== undefined) providerUpdateData.bio = dto.bio;
    if (dto.yearsOfExperience !== undefined) {
      providerUpdateData.yearsOfExperience = dto.yearsOfExperience;
    }
    if (dto.languagesSpoken !== undefined) {
      providerUpdateData.languagesSpoken = dto.languagesSpoken;
    }
    if (dto.gender !== undefined) providerUpdateData.gender = dto.gender;

    if (
      Object.keys(userUpdateData).length === 0 &&
      Object.keys(providerUpdateData).length === 0
    ) {
      throw new BadRequestException('No data to update');
    }

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userUpdateData,
        });
      }

      if (Object.keys(providerUpdateData).length > 0) {
        await tx.provider.update({
          where: { id: userId },
          data: providerUpdateData,
        });
      }

      return tx.user.findUnique({
        where: { id: userId },
        include: { provider: true },
      });
    });
  }

  /**
   * Soft-delete provider account: DELETED + deletedAt, clear provider.photoUrl,
   * remove avatar objects from storage. Requires correct Supabase password.
   */
  async softDeleteMe(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.PROVIDER) {
      throw new BadRequestException('Not a provider account');
    }
    if (!user.provider) {
      throw new NotFoundException(
        'Provider profile not found. Complete registration first.',
      );
    }
    if (user.status === AccountStatus.DELETED) {
      throw new ConflictException('Account is already deleted');
    }

    const verify = await this.supabase.verifyPasswordForEmail(
      user.email,
      password,
    );
    if (!verify.ok) {
      throw new UnauthorizedException(verify.message || 'Invalid password');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: AccountStatus.DELETED,
          deletedAt: now,
        },
      });
      await tx.provider.update({
        where: { id: userId },
        data: { photoUrl: null },
      });
    });

    await this.supabase.removeClientAvatarFolder(userId);

    return { message: 'Account deleted', deletedAt: now.toISOString() };
  }
}
