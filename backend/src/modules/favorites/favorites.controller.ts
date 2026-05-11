import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { FavoriteType, UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { resolveLocale } from '../../common/i18n/locale';
import { CreateClientFavoriteDto } from './dto/create-client-favorite.dto';
import { FavoritesService } from './favorites.service';

type AuthUser = { id: string };

@Controller('favorites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  listFavorites(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: FavoriteType,
    @Query('lang') lang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.favoritesService.listFavorites(
      user.id,
      type,
      resolveLocale(lang, acceptLanguage),
    );
  }

  @Post()
  createFavorite(@CurrentUser() user: AuthUser, @Body() dto: CreateClientFavoriteDto) {
    return this.favoritesService.createFavorite(user.id, dto);
  }

  @Delete(':type/:targetId')
  deleteFavorite(
    @CurrentUser() user: AuthUser,
    @Param('type', new ParseEnumPipe(FavoriteType)) type: FavoriteType,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    return this.favoritesService.deleteFavorite(user.id, type, targetId);
  }

  @Delete()
  clearFavorites(@CurrentUser() user: AuthUser, @Query('type') type?: FavoriteType) {
    return this.favoritesService.clearFavorites(user.id, type);
  }
}
