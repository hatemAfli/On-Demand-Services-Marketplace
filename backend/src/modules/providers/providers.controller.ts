import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SoftDeleteProviderDto } from './dto/soft-delete-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { ProvidersService } from './providers.service';

@Controller('providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PROVIDER)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return this.providersService.getMe(user.id);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: any, @Body() dto: UpdateProviderDto) {
    return this.providersService.updateMe(user.id, dto);
  }

  /** Soft-delete: status DELETED, deletedAt set, provider photo removed from storage. */
  @Post('me/soft-delete')
  async softDeleteMe(
    @CurrentUser() user: any,
    @Body() dto: SoftDeleteProviderDto,
  ) {
    return this.providersService.softDeleteMe(user.id, dto.password);
  }
}
