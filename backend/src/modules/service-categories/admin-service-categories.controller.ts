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
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { ListServiceCategoriesAdminQueryDto } from './dto/list-service-categories-admin-query.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { ServiceCategoriesService } from './service-categories.service';

/**
 * Platform admin — `ServiceCategory` CRUD for web dashboard.
 *
 * | Method | Path | Body / query |
 * |--------|------|----------------|
 * | GET | /api/admin/service-categories | ?activeOnly=true |
 * | GET | /api/admin/service-categories/:id | |
 * | POST | /api/admin/service-categories | { name, slug?, iconKey?, iconUrl?, sortOrder?, active? } |
 * | PATCH | /api/admin/service-categories/:id | partial fields incl. active |
 * | DELETE | /api/admin/service-categories/:id | 204; blocked if any `Service` uses this category |
 */
@Controller('admin/service-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminServiceCategoriesController {
  constructor(private readonly service: ServiceCategoriesService) {}

  @Get()
  list(
    @CurrentUser() _user: User,
    @Query() query: ListServiceCategoriesAdminQueryDto,
  ) {
    return this.service.listForAdmin(query);
  }

  @Get(':id')
  getOne(
    @CurrentUser() _user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOneForAdmin(id);
  }

  @Post()
  create(
    @CurrentUser() _user: User,
    @Body() dto: CreateServiceCategoryDto,
  ) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() _user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceCategoryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() _user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.remove(id);
  }
}
