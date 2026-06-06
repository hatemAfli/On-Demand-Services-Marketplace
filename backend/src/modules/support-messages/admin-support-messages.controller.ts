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
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { clientIp } from '../../common/utils/client-ip';
import {
  ListAdminSupportMessagesQueryDto,
  UpdateSupportMessageStatusDto,
} from './dto/support-message.dto';
import { SupportMessagesService } from './support-messages.service';

@Controller('admin/support-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminSupportMessagesController {
  constructor(private readonly service: SupportMessagesService) {}

  @Get('stats')
  stats() {
    return this.service.countNew().then((newCount) => ({ newCount }));
  }

  @Get()
  list(@Query() query: ListAdminSupportMessagesQueryDto) {
    return this.service.listForAdmin(query);
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getForAdmin(id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportMessageStatusDto,
    @Req() req: Request,
  ) {
    return this.service.updateStatus(id, dto.status, {
      actorAdminId: user.id,
      ipAddress: clientIp(req),
    });
  }
}
