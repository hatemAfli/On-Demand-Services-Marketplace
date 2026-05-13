import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetMessagesDto } from './dto/get-messages.dto';
import { MarkConversationReadDto } from './dto/mark-read.dto';
import { OpenOrCreateConversationDto } from './dto/open-or-create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  MessagingRole,
  MessagingService,
} from './messaging.service';

type RequestUser = { id: string; role: UserRole };

@Controller('messaging')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  private messagingRole(role: UserRole): MessagingRole {
    return role as MessagingRole;
  }

  /** Client: message on provider profile. Provider: message from client appointment. */
  @Post('conversations')
  @Roles(UserRole.CLIENT, UserRole.PROVIDER)
  openOrCreateConversation(
    @Req() req: Request & { user: RequestUser },
    @Body() dto: OpenOrCreateConversationDto,
  ) {
    const user = req.user;
    return this.messagingService.openOrCreateConversation(
      user.id,
      this.messagingRole(user.role),
      dto.counterpartId,
    );
  }

  @Get('conversations')
  @Roles(UserRole.CLIENT, UserRole.PROVIDER)
  getMyConversations(@Req() req: Request & { user: RequestUser }) {
    const user = req.user;
    return this.messagingService.getMyConversations(
      user.id,
      this.messagingRole(user.role),
    );
  }

  @Get('messages')
  @Roles(UserRole.CLIENT, UserRole.PROVIDER)
  getMessages(
    @Req() req: Request & { user: RequestUser },
    @Query() dto: GetMessagesDto,
  ) {
    return this.messagingService.getMessages(req.user.id, dto);
  }

  @Post('messages')
  @Roles(UserRole.CLIENT, UserRole.PROVIDER)
  sendMessage(
    @Req() req: Request & { user: RequestUser },
    @Body() dto: SendMessageDto,
  ) {
    const user = req.user;
    return this.messagingService.sendMessage(
      user.id,
      this.messagingRole(user.role),
      dto,
    );
  }

  @Patch('messages/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.CLIENT, UserRole.PROVIDER)
  async markAsRead(
    @Req() req: Request & { user: RequestUser },
    @Body() dto: MarkConversationReadDto,
  ): Promise<void> {
    const user = req.user;
    await this.messagingService.markAsRead(
      user.id,
      this.messagingRole(user.role),
      dto,
    );
  }
}
