import {
  Body,
  Controller,
  Get,
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportMessageStatusDto,
  ) {
    return this.service.updateStatus(id, dto.status);
  }
}
