import { Injectable } from '@nestjs/common';
import { OwnerType, PricingType, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class GivenServiceService {
  constructor(private readonly prisma: PrismaService) {}

  async createPendingForOwner(
    input: { ownerType: OwnerType; ownerId: string; serviceId: string },
    tx?: TxClient,
  ) {
    const client = tx ?? this.prisma;
    const existing = await client.givenService.findFirst({
      where: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        serviceId: input.serviceId,
      },
    });

    if (existing) {
      return existing;
    }

    return client.givenService.create({
      data: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        serviceId: input.serviceId,
        pricingType: PricingType.FIXED,
        price: 0,
        active: false,
      },
    });
  }

  async activateForOwnerService(
    input: { ownerType: OwnerType; ownerId: string; serviceId: string },
    tx?: TxClient,
  ) {
    const client = tx ?? this.prisma;
    return client.givenService.updateMany({
      where: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        serviceId: input.serviceId,
      },
      data: { active: true },
    });
  }
}

