import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { clientIp } from '../../common/utils/client-ip';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('complete-registration')
  @UseGuards(JwtAuthGuard)
  async completeRegistration(
    @CurrentUser() user: any,
    @Body() body: CompleteRegistrationDto,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'];
    return this.authService.completeRegistration(
      user.id,
      {
        email: user.tokenEmail ?? user.email,
        isEmailVerified: user?.isEmailVerified === true,
        ...body,
      },
      {
        ipAddress: clientIp(req),
        userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      },
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    return this.authService.getCurrentUser({
      id: user.id,
      email: user.tokenEmail ?? user.email,
    });
  }

  @Post('magic-login/lookup')
  async lookupMagicLoginAccount(@Body() body: { email: string }) {
    return this.authService.lookupMagicLoginAccount(body);
  }

  @Post('email-change/check')
  @UseGuards(JwtAuthGuard)
  async checkEmailChangeAvailability(
    @CurrentUser() user: any,
    @Body() body: { email: string },
  ) {
    return this.authService.checkEmailChangeAvailability(user.id, body);
  }
}
