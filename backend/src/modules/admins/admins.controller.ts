import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminsService } from './admins.service';
import { UpdateAdminDto } from './dto/update-admin.dto';

type AuthUser = { id: string };

@Controller('admins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateAdminDto) {
    return this.adminsService.updateMe(user.id, dto);
  }
}
