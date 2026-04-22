import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.config';
import { ListAdminCompaniesQueryDto } from './dto/list-admin-companies-query.dto';

@Injectable()
export class AdminCompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAdminCompaniesQueryDto) {
    const take = query.take ?? 200;
    const skip = query.skip ?? 0;

    const [rows, total] = await Promise.all([
      this.prisma.company.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          companyName: true,
          taxId: true,
          logo: true,
          city: true,
          address: true,
          email: true,
          latitude: true,
          longitude: true,
          serviceZones: true,
          averageRating: true,
          totalReviews: true,
          adminId: true,
          createdAt: true,
          updatedAt: true,
          admin: {
            select: {
              id: true,
              user: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                  status: true,
                },
              },
            },
          },
          _count: { select: { providers: true } },
        },
      }),
      this.prisma.company.count(),
    ]);

    const items = rows.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      taxId: c.taxId,
      logo: c.logo,
      city: c.city,
      address: c.address,
      email: c.email,
      latitude: c.latitude,
      longitude: c.longitude,
      serviceZones: c.serviceZones,
      averageRating:
        c.averageRating != null ? Number(c.averageRating) : null,
      totalReviews: c.totalReviews,
      adminId: c.adminId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      providersCount: c._count.providers,
      adminUser: c.admin?.user
        ? {
            email: c.admin.user.email,
            firstName: c.admin.user.firstName,
            lastName: c.admin.user.lastName,
            status: c.admin.user.status,
          }
        : null,
    }));

    return { items, total, skip, take };
  }
}
