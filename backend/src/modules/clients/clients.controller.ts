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
import { CreateClientDto } from './dto/create-client.dto';
import { SoftDeleteClientDto } from './dto/soft-delete-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsService } from './clients.service';

type AuthUser = { id: string };

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.clientsService.getMe(user.id);
  }

  @Post('me')
  createMe(@CurrentUser() user: AuthUser, @Body() dto: CreateClientDto) {
    return this.clientsService.createMe(user.id, dto);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateClientDto) {
    return this.clientsService.updateMe(user.id, dto);
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
