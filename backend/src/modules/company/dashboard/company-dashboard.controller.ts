import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CompanyDashboardService } from './company-dashboard.service';

type AuthUser = { id: string; role: UserRole };

@Controller('company/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN)
export class CompanyDashboardController {
  constructor(private readonly service: CompanyDashboardService) {}

  @Get()
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.service.getDashboard(user.id);
  }
}
