import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MarkNotificationsReadDto } from './dto/mark-read.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { NotificationsService } from './notifications.service';

type AuthUser = { id: string };

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('push-token')
  async registerPushToken(@CurrentUser() user: AuthUser, @Body() dto: RegisterPushTokenDto) {
    await this.notificationsService.registerPushToken(user.id, dto);
    return { ok: true };
  }

  @Delete('push-token/:token')
  async unregisterPushToken(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    await this.notificationsService.unregisterPushToken(
      user.id,
      decodeURIComponent(token),
    );
    return { ok: true };
  }

  @Get()
  getMyNotifications(
    @CurrentUser() user: AuthUser,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(30), ParseIntPipe) take: number,
  ) {
    return this.notificationsService.getMyNotifications(user.id, skip, take);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthUser) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Patch('mark-read')
  async markAsRead(@CurrentUser() user: AuthUser, @Body() dto: MarkNotificationsReadDto) {
    await this.notificationsService.markAsRead(user.id, dto);
    return { ok: true };
  }
}
