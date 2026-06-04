import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FaqService } from './faq.service';

@Controller('faq')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT, UserRole.PROVIDER)
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('lang') lang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const localeRaw = lang ?? acceptLanguage;
    return this.faqService.listPublishedForRole(user.role, localeRaw);
  }
}
