import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { UpdateUserIdentityDto } from './dto/update-user-identity.dto';

@Injectable()
export class UserAccountService {
  constructor(private prisma: PrismaService) {}

  private buildUpdateData(dto: UpdateUserIdentityDto): Prisma.UserUpdateInput {
    const data: Prisma.UserUpdateInput = {};

    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber;
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;

    return data;
  }

  async updateUserIdentity(
    userId: string,
    dto: UpdateUserIdentityDto,
  ): Promise<unknown> {
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('No data to update');
    }

    const data = this.buildUpdateData(dto);

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data,
      });
    } catch (err: unknown) {
      this.throwIfPrismaKnownError(err);
      throw err;
    }
  }

  async deleteUserCascade(userId: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id: userId } });
    } catch (err: unknown) {
      this.throwIfPrismaKnownError(err);
      throw err;
    }
  }

  buildUserUpdateData(dto: UpdateUserIdentityDto): Prisma.UserUpdateInput {
    return this.buildUpdateData(dto);
  }

  private throwIfPrismaKnownError(err: unknown): never | void {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return;

    // https://www.prisma.io/docs/orm/reference/error-reference#p2002-unique-constraint-failed
    if (err.code === 'P2002') {
      throw new ConflictException('Email or phone number already exists');
    }
    if (err.code === 'P2025') {
      throw new NotFoundException('User not found');
    }
  }
}
