import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(UserRole.PLATFORM_ADMIN) // Only admins can list all users
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.PLATFORM_ADMIN) // Only admins can view specific users
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
