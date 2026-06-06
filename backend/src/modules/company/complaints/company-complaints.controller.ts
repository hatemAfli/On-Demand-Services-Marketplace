import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { clientIp } from '../../../common/utils/client-ip';
import { CompanyComplaintsService } from './company-complaints.service';
import { ListCompanyComplaintsDto } from './dto/list-company-complaints.dto';
import { ReviewCompanyComplaintDto } from './dto/review-company-complaint.dto';

type AuthUser = { id: string; role: UserRole };

@Controller('company/complaints')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN)
export class CompanyComplaintsController {
  constructor(private readonly service: CompanyComplaintsService) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser) {
    return this.service.getStats(user.id);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() dto: ListCompanyComplaintsDto,
  ) {
    return this.service.list(user.id, dto);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getById(user.id, id);
  }

  @Patch(':id/review')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewCompanyComplaintDto,
    @Req() req: Request,
  ) {
    return this.service.review(user.id, id, dto, clientIp(req));
  }
}
