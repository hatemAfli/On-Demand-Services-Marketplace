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
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminUsersService } from './admin-users.service';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { UpdateAdminUserStatusDto } from './dto/update-admin-user-status.dto';

type RequestUser = { id: string; role: UserRole };

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  list(@Query() query: ListAdminUsersQueryDto) {
    return this.adminUsersService.list(query);
  }

  @Get(':id')
  getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminUsersService.getById(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: Request & { user: RequestUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAdminUserStatusDto,
  ) {
    return this.adminUsersService.updateStatus(id, req.user.id, dto);
  }
}
