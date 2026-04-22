import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { resolveLocale } from '../../common/i18n/locale';
import { ServicesService } from './services.service';

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  /** Active catalog services for one category (marketplace discovery). */
  @Get('category/:categoryId')
  listByCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query('lang') lang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.servicesService.findByCategoryId(
      categoryId,
      resolveLocale(lang, acceptLanguage),
    );
  }

  @Get()
  list(
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('lang') lang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.servicesService.findAll({
      categoryId,
      categorySlug,
      locale: resolveLocale(lang, acceptLanguage),
    });
  }
}
