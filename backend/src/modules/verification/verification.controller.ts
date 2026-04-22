import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ResubmitVerificationDto } from './dto/resubmit-verification.dto';
import { VerificationService } from './verification.service';

@Controller('verification-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PROVIDER, UserRole.COMPANY_ADMIN)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('me/latest')
  getMyLatestRequest(@CurrentUser() user: User) {
    return this.verificationService.getLatestVerificationRequestForCurrentUser(
      user,
    );
  }

  @Post('me/resubmit')
  resubmit(@CurrentUser() user: User, @Body() body: ResubmitVerificationDto) {
    return this.verificationService.resubmitVerificationForCurrentUser(
      user,
      body,
    );
  }
}
