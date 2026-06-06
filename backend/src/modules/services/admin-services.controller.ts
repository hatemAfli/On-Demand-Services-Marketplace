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
import { CreateAdminServiceDto } from './dto/create-admin-service.dto';
import { ListServicesAdminQueryDto } from './dto/list-services-admin-query.dto';
import { UpdateAdminServiceDto } from './dto/update-admin-service.dto';
import { ServicesService } from './services.service';

@Controller('admin/services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  private auditCtx(user: User, req: Request) {
    return { actorAdminId: user.id, ipAddress: clientIp(req) };
  }

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
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateAdminServiceDto,
    @Req() req: Request,
  ) {
    return this.servicesService.adminCreate(dto, this.auditCtx(user, req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminServiceDto,
    @Req() req: Request,
  ) {
    return this.servicesService.adminUpdate(id, dto, this.auditCtx(user, req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    await this.servicesService.adminRemove(id, this.auditCtx(user, req));
  }
}
