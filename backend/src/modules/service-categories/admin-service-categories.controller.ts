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
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { clientIp } from '../../common/utils/client-ip';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { ListServiceCategoriesAdminQueryDto } from './dto/list-service-categories-admin-query.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { ServiceCategoriesService } from './service-categories.service';

@Controller('admin/service-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminServiceCategoriesController {
  constructor(private readonly service: ServiceCategoriesService) {}

  private auditCtx(user: User, req: Request) {
    return { actorAdminId: user.id, ipAddress: clientIp(req) };
  }

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
    @CurrentUser() user: User,
    @Body() dto: CreateServiceCategoryDto,
    @Req() req: Request,
  ) {
    return this.service.create(dto, this.auditCtx(user, req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceCategoryDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, this.auditCtx(user, req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.service.remove(id, this.auditCtx(user, req));
  }
}
