import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CompanyReviewsService } from './company-reviews.service';
import { ListCompanyReviewsDto } from './dto/list-company-reviews.dto';

type AuthUser = { id: string; role: UserRole };

@Controller('company/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN)
export class CompanyReviewsController {
  constructor(private readonly service: CompanyReviewsService) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser) {
    return this.service.getStats(user.id);
  }

  @Get('breakdown')
  getBreakdown(@CurrentUser() user: AuthUser) {
    return this.service.getBreakdown(user.id);
  }

  @Get('by-service')
  getByService(@CurrentUser() user: AuthUser) {
    return this.service.getByService(user.id);
  }

  @Get('trends')
  getTrends(@CurrentUser() user: AuthUser) {
    return this.service.getTrends(user.id);
  }

  @Get('top-providers')
  getTopProviders(@CurrentUser() user: AuthUser) {
    return this.service.getTopProviders(user.id);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() dto: ListCompanyReviewsDto,
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
}
