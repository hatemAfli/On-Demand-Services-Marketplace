import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { UserAccountService } from '../accounts/user-account.service';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminsService {
  constructor(
    private prisma: PrismaService,
    private userAccount: UserAccountService,
  ) {}

  async updateMe(userId: string, dto: UpdateAdminDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { platformAdmin: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.PLATFORM_ADMIN) {
      throw new BadRequestException('Not a platform admin account');
    }
    if (!user.platformAdmin) {
      throw new NotFoundException(
        'Platform admin profile not found. Complete registration first.',
      );
    }

    const userUpdateData = this.userAccount.buildUserUpdateData(dto);
    if (Object.keys(userUpdateData).length === 0) {
      throw new BadRequestException('No data to update');
    }

    await this.userAccount.updateUserIdentity(userId, dto);

    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { platformAdmin: true },
    });
  }
}
