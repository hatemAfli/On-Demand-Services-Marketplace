import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { UserAccountService } from '../accounts/user-account.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private userAccount: UserAccountService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });

    if (!user || !user.client) {
      throw new NotFoundException(
        'Client profile not found. Complete registration first.',
      );
    }

    // Extra safety (role guard should already enforce this)
    if (user.role !== UserRole.CLIENT) {
      throw new BadRequestException('Not a client account');
    }

    return user;
  }

  async createMe(userId: string, dto: CreateClientDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.CLIENT) {
      throw new BadRequestException('Not a client account');
    }

    if (user.client) {
      throw new ConflictException(
        'Client profile already exists. Use PATCH to update.',
      );
    }

    const userUpdateData = this.userAccount.buildUserUpdateData(dto);

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userUpdateData,
        });
      }

      await tx.client.create({
        data: {
          id: userId,
          city: dto.city,
          address: dto.address,
          imageUrl: dto.imageUrl,
        },
      });

      return tx.user.findUnique({
        where: { id: userId },
        include: { client: true },
      });
    });
  }

  async updateMe(userId: string, dto: UpdateClientDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.CLIENT) {
      throw new BadRequestException('Not a client account');
    }
    if (!user.client) {
      throw new NotFoundException(
        'Client profile not found. Use POST /api/clients/me first.',
      );
    }

    const userUpdateData = this.userAccount.buildUserUpdateData(dto);
    const clientUpdateData: Prisma.ClientUpdateInput = {};

    if (dto.city !== undefined) clientUpdateData.city = dto.city;
    if (dto.address !== undefined) clientUpdateData.address = dto.address;
    if (dto.imageUrl !== undefined) clientUpdateData.imageUrl = dto.imageUrl;

    if (
      Object.keys(userUpdateData).length === 0 &&
      Object.keys(clientUpdateData).length === 0
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

      if (Object.keys(clientUpdateData).length > 0) {
        await tx.client.update({
          where: { id: userId },
          data: clientUpdateData,
        });
      }

      return tx.user.findUnique({
        where: { id: userId },
        include: { client: true },
      });
    });
  }

  async deleteMe(userId: string) {
    await this.userAccount.deleteUserCascade(userId);
    return { message: 'Client account deleted' };
  }
}
