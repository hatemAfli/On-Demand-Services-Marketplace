import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OwnerType,
  PricingType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { UpdateProviderGivenServiceDto } from './dto/update-provider-given-service.dto';

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

  private async assertProviderUser(userId: string) {
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
    return user;
  }

  async getProviderGivenService(userId: string, serviceId: string) {
    await this.assertProviderUser(userId);
    const given = await this.prisma.givenService.findFirst({
      where: {
        ownerType: OwnerType.PROVIDER,
        ownerId: userId,
        serviceId,
      },
    });
    if (!given) {
      throw new NotFoundException(
        'No given service found for this catalog service. Complete registration or pick another service.',
      );
    }
    return given;
  }

  async updateProviderGivenService(
    userId: string,
    serviceId: string,
    dto: UpdateProviderGivenServiceDto,
  ) {
    await this.assertProviderUser(userId);
    const existing = await this.prisma.givenService.findFirst({
      where: {
        ownerType: OwnerType.PROVIDER,
        ownerId: userId,
        serviceId,
      },
    });
    if (!existing) {
      throw new NotFoundException(
        'No given service found for this catalog service.',
      );
    }

    const data: Prisma.GivenServiceUpdateInput = {};
    if (dto.pricingType !== undefined) data.pricingType = dto.pricingType;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.minimumHours !== undefined) data.minimumHours = dto.minimumHours;
    if (dto.estimatedDurationMinutes !== undefined) {
      data.estimatedDurationMinutes = dto.estimatedDurationMinutes;
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.whatIsIncluded !== undefined) {
      data.whatIsIncluded = dto.whatIsIncluded;
    }
    if (dto.whatIsNotIncluded !== undefined) {
      data.whatIsNotIncluded = dto.whatIsNotIncluded;
    }
    if (dto.clientMustProvide !== undefined) {
      data.clientMustProvide = dto.clientMustProvide;
    }
    if (dto.serviceAreaNotes !== undefined) {
      data.serviceAreaNotes = dto.serviceAreaNotes;
    }
    if (dto.advanceBookingRequiredHours !== undefined) {
      data.advanceBookingRequiredHours = dto.advanceBookingRequiredHours;
    }
    if (dto.serviceRadiusKm !== undefined) {
      data.serviceRadiusKm = dto.serviceRadiusKm;
    }
    if (dto.toolsProvidedByProvider !== undefined) {
      data.toolsProvidedByProvider = dto.toolsProvidedByProvider;
    }
    if (dto.isAvailableImmediately !== undefined) {
      data.isAvailableImmediately = dto.isAvailableImmediately;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No data to update');
    }

    return this.prisma.givenService.update({
      where: { id: existing.id },
      data,
    });
  }
}

