import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminChatbotService } from './admin-chatbot.service';
import { ListAdminChatbotSessionsDto } from './dto/list-admin-chatbot-sessions.dto';

@Controller('admin/chatbot')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminChatbotController {
  constructor(private readonly adminChatbot: AdminChatbotService) {}

  @Get('stats')
  stats() {
    return this.adminChatbot.getStats();
  }

  @Get('sessions')
  listSessions(@Query() query: ListAdminChatbotSessionsDto) {
    return this.adminChatbot.listSessions(query);
  }

  @Get('sessions/:sessionId')
  async getSession(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    const detail = await this.adminChatbot.getSessionDetail(sessionId);
    if (!detail) {
      throw new NotFoundException('Chat session not found');
    }
    return detail;
  }
}
