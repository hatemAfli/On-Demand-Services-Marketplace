import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  BadRequestException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ChatbotSecretGuard } from '../../common/guards/chatbot-secret.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SearchService } from '../search/search.service';
import { ChatbotService } from './chatbot.service';
import { ChatDto } from './dto/chat.dto';
import { ChatbotServiceDto } from './dto/chatbot-service.dto';
import { CreateChatbotSessionDto } from './dto/create-chatbot-session.dto';

type AuthUser = { id: string };

@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly searchService: SearchService,
  ) {}

  @Post('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  @HttpCode(201)
  createSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateChatbotSessionDto,
  ) {
    return this.chatbotService.createSession(user.id, dto);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  listSessions(@CurrentUser() user: AuthUser) {
    return this.chatbotService.listSessions(user.id);
  }

  @Get('sessions/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  getSession(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.chatbotService.getSession(sessionId, user.id);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  @HttpCode(200)
  deleteSession(
    @CurrentUser() user: AuthUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.chatbotService.deleteSession(sessionId, user.id);
  }

  @Post('chat')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  @HttpCode(200)
  chat(@CurrentUser() user: AuthUser, @Body() dto: ChatDto) {
    return this.chatbotService.chat(dto, user.id);
  }

  /** Secret-protected bridge for the Python chatbot (search + catalog resolve). */
  @Post('service')
  @UseGuards(ChatbotSecretGuard)
  @HttpCode(200)
  service(@Body() dto: ChatbotServiceDto) {
    if (dto.action === 'search') {
      if (!dto.search) {
        throw new BadRequestException('search payload is required');
      }
      return this.searchService.search(dto.search);
    }
    if (dto.action === 'resolve-service') {
      return this.searchService.resolveServiceId(
        dto.query ?? '',
        dto.locale ?? 'en',
      );
    }
    throw new BadRequestException('Unknown action');
  }
}
