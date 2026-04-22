import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ListVerificationRequestsQueryDto } from './dto/list-verification-requests-query.dto';
import { RejectVerificationRequestDto } from './dto/reject-verification-request.dto';
import { VerificationService } from './verification.service';

@Controller('admin/verification-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminVerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query() query: ListVerificationRequestsQueryDto,
  ) {
    return this.verificationService.listVerificationRequestsForAdmin(
      user,
      query,
    );
  }

  @Get(':id')
  getOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.verificationService.getVerificationRequestForAdmin(user, id);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.verificationService.approveRequest(user, id);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVerificationRequestDto,
  ) {
    return this.verificationService.rejectRequest(user, id, dto.reason);
  }

  @Patch(':id/review')
  markReview(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.verificationService.markUnderReview(user, id);
  }
}
