import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CompaniesPublicService } from './companies-public.service';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class CompaniesPublicController {
  constructor(
    private readonly companiesPublicService: CompaniesPublicService,
  ) {}

  // GET /companies/:companyId/profile?serviceId=&locale=
  @Get(':companyId/profile')
  getCompanyProfile(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Query('serviceId') serviceId?: string,
    @Query('locale') locale?: string,
  ) {
    return this.companiesPublicService.getCompanyProfile(
      companyId,
      serviceId,
      locale,
    );
  }
}
