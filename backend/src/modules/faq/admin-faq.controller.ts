import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CreateFaqItemDto, UpdateFaqItemDto } from './dto/admin-faq.dto';
import { FaqService } from './faq.service';

@Controller('admin/faq')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminFaqController {
  constructor(private readonly faqService: FaqService) {}

  private auditCtx(user: User, req: Request) {
    return { actorAdminId: user.id, ipAddress: clientIp(req) };
  }

  @Get()
  list() {
    return this.faqService.listForAdmin();
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateFaqItemDto,
    @Req() req: Request,
  ) {
    return this.faqService.create(dto, this.auditCtx(user, req));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaqItemDto,
    @Req() req: Request,
  ) {
    return this.faqService.update(id, dto, this.auditCtx(user, req));
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.faqService.remove(id, this.auditCtx(user, req));
  }
}
