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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { clientIp } from '../../common/utils/client-ip';
import { AdminReviewsService } from './admin-reviews.service';
import { GetAdminReviewsDto } from './dto/get-admin-reviews.dto';
import { HideReviewDto } from './dto/hide-review.dto';

type RequestUser = { id: string; role: UserRole };

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  @Get('stats')
  getStats() {
    return this.adminReviewsService.getStats();
  }

  @Get()
  list(@Query() query: GetAdminReviewsDto) {
    return this.adminReviewsService.list(query);
  }

  @Get(':id')
  getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminReviewsService.getById(id);
  }

  @Patch(':id/hide')
  hide(
    @Req() req: Request & { user: RequestUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: HideReviewDto,
  ) {
    return this.adminReviewsService.hide(id, dto, {
      actorAdminId: req.user.id,
      ipAddress: clientIp(req),
    });
  }

  @Patch(':id/restore')
  restore(
    @Req() req: Request & { user: RequestUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.adminReviewsService.restore(id, {
      actorAdminId: req.user.id,
      ipAddress: clientIp(req),
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: Request & { user: RequestUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.adminReviewsService.remove(id, {
      actorAdminId: req.user.id,
      ipAddress: clientIp(req),
    });
  }
}
