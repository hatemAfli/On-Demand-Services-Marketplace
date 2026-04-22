import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { resolveLocale } from '../../common/i18n/locale';
import { ServiceCategoriesService } from './service-categories.service';

@Controller('service-categories')
@UseGuards(JwtAuthGuard)
export class ServiceCategoriesController {
  constructor(private readonly service: ServiceCategoriesService) {}

  /** Active categories for client home and filters (requires auth like `/services`). */
  @Get()
  listActive(
    @Query('lang') lang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.service.findActiveForMarketplace(
      resolveLocale(lang, acceptLanguage),
    );
  }
}
