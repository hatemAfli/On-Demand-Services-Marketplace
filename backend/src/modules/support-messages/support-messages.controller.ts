import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSupportMessageDto } from './dto/support-message.dto';
import { SupportMessagesService } from './support-messages.service';

@Controller('support/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT, UserRole.PROVIDER)
export class SupportMessagesController {
  constructor(private readonly service: SupportMessagesService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateSupportMessageDto) {
    return this.service.createForUser(user, dto);
  }
}
