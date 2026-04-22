import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateAdminServiceDto } from './dto/create-admin-service.dto';
import { ListServicesAdminQueryDto } from './dto/list-services-admin-query.dto';
import { UpdateAdminServiceDto } from './dto/update-admin-service.dto';
import { ServicesService } from './services.service';

/**
 * Platform admin — catalog `Service` CRUD for web dashboard.
 *
 * | Method | Path | Body / query |
 * |--------|------|----------------|
 * | GET | /api/admin/services | ?activeOnly=true&categoryId=uuid |
 * | GET | /api/admin/services/:id | |
 * | POST | /api/admin/services | { name, categoryId, description?, active? } |
 * | PATCH | /api/admin/services/:id | partial name, description, categoryId, active |
 * | DELETE | /api/admin/services/:id | 204; blocked if verification requests reference this service |
 */
@Controller('admin/services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  list(
    @CurrentUser() _user: User,
    @Query() query: ListServicesAdminQueryDto,
  ) {
    return this.servicesService.adminList(query);
  }

  @Get(':id')
  getOne(
    @CurrentUser() _user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.servicesService.adminFindOne(id);
  }

  @Post()
  create(@CurrentUser() _user: User, @Body() dto: CreateAdminServiceDto) {
    return this.servicesService.adminCreate(dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() _user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminServiceDto,
  ) {
    return this.servicesService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() _user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.servicesService.adminRemove(id);
  }
}
