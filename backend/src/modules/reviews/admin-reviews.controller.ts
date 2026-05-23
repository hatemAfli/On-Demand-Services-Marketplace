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
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminReviewsService } from './admin-reviews.service';
import { GetAdminReviewsDto } from './dto/get-admin-reviews.dto';
import { HideReviewDto } from './dto/hide-review.dto';

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
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: HideReviewDto,
  ) {
    return this.adminReviewsService.hide(id, dto);
  }

  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminReviewsService.restore(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.adminReviewsService.remove(id);
  }
}
