import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resolveLocale } from '../../common/i18n/locale';
import { AddClientSearchHistoryDto } from './dto/add-client-search-history.dto';
import { SoftDeleteClientDto } from './dto/soft-delete-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientHomeService } from './client-home.service';
import { PopularNearbyQueryDto } from './dto/popular-nearby-query.dto';
import { ClientsService } from './clients.service';

type AuthUser = { id: string };

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly clientHomeService: ClientHomeService,
  ) {}

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateClientDto) {
    return this.clientsService.updateMe(user.id, dto);
  }

  @Get('me/home/popular-nearby')
  getPopularNearby(
    @CurrentUser() user: AuthUser,
    @Query() query: PopularNearbyQueryDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const locale = resolveLocale(query.lang, acceptLanguage);
    return this.clientHomeService.getPopularNearby(
      user.id,
      locale,
      query.clientLat,
      query.clientLng,
    );
  }

  @Get('me/search-history')
  getSearchHistory(
    @CurrentUser() user: AuthUser,
    @Query('lang') lang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<unknown> {
    return this.clientsService.getSearchHistory(
      user.id,
      resolveLocale(lang, acceptLanguage),
    ) as Promise<unknown>;
  }

  @Post('me/search-history')
  addSearchHistory(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddClientSearchHistoryDto,
    @Query('lang') lang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<unknown> {
    return this.clientsService.addSearchHistory(
      user.id,
      dto,
      resolveLocale(lang, acceptLanguage),
    ) as Promise<unknown>;
  }

  @Delete('me/search-history')
  clearSearchHistory(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.clientsService.clearSearchHistory(user.id) as Promise<unknown>;
  }

  /** Soft-delete: status DELETED, deletedAt set, profile image removed from storage. */
  @Post('me/soft-delete')
  async softDeleteMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: SoftDeleteClientDto,
  ) {
    return this.clientsService.softDeleteMe(user.id, dto.password);
  }
}
