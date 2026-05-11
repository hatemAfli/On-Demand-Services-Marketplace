import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Locale,
  OwnerType,
  PricingType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { UpdateProviderGivenServiceDto } from './dto/update-provider-given-service.dto';
import { UpdateProviderServiceGalleryDto } from './dto/update-provider-service-gallery.dto';

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
      include: {
        galleries: {
          select: { id: true, imageUrl: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!given) {
      throw new NotFoundException(
        'No given service found for this catalog service. Complete registration or pick another service.',
      );
    }
    return given;
  }

  async getGivenServiceForClient(givenServiceId: string, localeRaw?: string) {
    const locale: Locale = localeRaw?.toUpperCase() === 'AR' ? 'AR' : 'EN';

    const given = await this.prisma.givenService.findUnique({
      where: { id: givenServiceId },
      include: {
        service: {
          include: {
            translations: { where: { locale } },
            category: {
              include: { translations: { where: { locale } } },
            },
          },
        },
        galleries: {
          select: { id: true, imageUrl: true },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!given || !given.active) {
      throw new NotFoundException('Given service not found.');
    }

    if (given.ownerType === OwnerType.PROVIDER) {
      const provider = await this.prisma.provider.findUnique({
        where: { id: given.ownerId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!provider) throw new NotFoundException('Provider not found.');

      return {
        givenServiceId: given.id,
        serviceId: given.serviceId,
        serviceName: given.service.translations[0]?.name ?? '',
        categoryName: given.service.category.translations[0]?.name ?? '',
        pricingType: given.pricingType,
        price: given.price,
        minimumHours: given.minimumHours ?? null,
        estimatedDurationMinutes: given.estimatedDurationMinutes ?? null,
        description: given.description ?? null,
        whatIsIncluded: given.whatIsIncluded ?? null,
        whatIsNotIncluded: given.whatIsNotIncluded ?? null,
        toolsProvidedByProvider: given.toolsProvidedByProvider ?? null,
        clientMustProvide: given.clientMustProvide ?? null,
        averageRating: Number(given.averageRating ?? 0),
        totalReviews: Number(given.totalReviews ?? 0),
        totalCompletedJobs: Number(given.totalCompletedJobs ?? 0),
        galleries: given.galleries,
        bookingProviderId: provider.id,
        owner: {
          id: provider.id,
          type: 'PROVIDER',
          displayName:
            `${provider.user?.firstName ?? ''} ${provider.user?.lastName ?? ''}`.trim(),
          photoUrl: provider.photoUrl ?? null,
          tagline: provider.tagline ?? null,
          bio: provider.bio ?? null,
          yearsOfExperience: provider.yearsOfExperience ?? null,
          languagesSpoken: provider.languagesSpoken ?? [],
          paymentMethodsAccepted: provider.paymentMethodsAccepted ?? [],
          averageRating: Number(given.averageRating ?? 0),
          totalReviews: Number(provider.totalReviews ?? 0),
          cancellationRate: Number(provider.cancellationRate ?? 0),
          gender: provider.gender ?? null,
        },
      };
    }

    const company = await this.prisma.company.findUnique({
      where: { id: given.ownerId },
    });
    if (!company) throw new NotFoundException('Company not found.');

    const companyProvider = await this.prisma.provider.findFirst({
      where: { companyId: company.id },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      givenServiceId: given.id,
      serviceId: given.serviceId,
      serviceName: given.service.translations[0]?.name ?? '',
      categoryName: given.service.category.translations[0]?.name ?? '',
      pricingType: given.pricingType,
      price: given.price,
      minimumHours: given.minimumHours ?? null,
      estimatedDurationMinutes: given.estimatedDurationMinutes ?? null,
      description: given.description ?? null,
      whatIsIncluded: given.whatIsIncluded ?? null,
      whatIsNotIncluded: given.whatIsNotIncluded ?? null,
      toolsProvidedByProvider: given.toolsProvidedByProvider ?? null,
      clientMustProvide: given.clientMustProvide ?? null,
      averageRating: Number(given.averageRating ?? 0),
      totalReviews: Number(given.totalReviews ?? 0),
      totalCompletedJobs: Number(given.totalCompletedJobs ?? 0),
      galleries: given.galleries,
      bookingProviderId: companyProvider?.id ?? null,
      owner: {
        id: company.id,
        type: 'COMPANY',
        displayName: company.companyName,
        photoUrl: company.logo ?? null,
        tagline: null,
        bio: null,
        yearsOfExperience: null,
        languagesSpoken: [],
        paymentMethodsAccepted: [],
        averageRating: Number(company.averageRating ?? 0),
        totalReviews: Number(company.totalReviews ?? 0),
        cancellationRate: 0,
        gender: null,
      },
    };
  }

  async getProviderServiceGallery(userId: string, serviceId: string) {
    await this.assertProviderUser(userId);
    const given = await this.prisma.givenService.findFirst({
      where: {
        ownerType: OwnerType.PROVIDER,
        ownerId: userId,
        serviceId,
      },
      select: {
        id: true,
        galleries: {
          select: { id: true, imageUrl: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!given) {
      throw new NotFoundException(
        'No given service found for this catalog service.',
      );
    }

    return {
      givenServiceId: given.id,
      images: given.galleries,
    };
  }

  async updateProviderServiceGallery(
    userId: string,
    serviceId: string,
    dto: UpdateProviderServiceGalleryDto,
  ) {
    await this.assertProviderUser(userId);
    const given = await this.prisma.givenService.findFirst({
      where: {
        ownerType: OwnerType.PROVIDER,
        ownerId: userId,
        serviceId,
      },
      select: { id: true },
    });
    if (!given) {
      throw new NotFoundException(
        'No given service found for this catalog service.',
      );
    }

    const imageUrls = Array.from(
      new Set((dto.imageUrls ?? []).map((u) => u.trim()).filter(Boolean)),
    );
    if (imageUrls.length > 40) {
      throw new BadRequestException('Maximum 40 gallery images');
    }

    const rows = imageUrls.map((imageUrl) => ({
      givenServiceId: given.id,
      imageUrl,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceGallery.deleteMany({
        where: { givenServiceId: given.id },
      });
      if (rows.length > 0) {
        await tx.serviceGallery.createMany({
          // Prisma client types can be stale before `prisma generate` after schema edits.
          data: rows as Prisma.ServiceGalleryCreateManyInput[],
        });
      }
    });

    return this.getProviderServiceGallery(userId, serviceId);
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
