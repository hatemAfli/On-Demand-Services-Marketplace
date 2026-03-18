import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.config';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        client: true,
        provider: true,
        companyAdmin: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        client: true,
        provider: true,
        companyAdmin: true,
      },
    });
  }
}
