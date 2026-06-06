import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { ListVerificationRequestsQueryDto } from './dto/list-verification-requests-query.dto';
import { RejectVerificationRequestDto } from './dto/reject-verification-request.dto';
import { ReviewVerificationDocumentDto } from './dto/review-verification-document.dto';
import { VerificationService } from './verification.service';

@Controller('admin/verification-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminVerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  private auditCtx(user: User, req: Request) {
    return { actorAdminId: user.id, ipAddress: clientIp(req) };
  }

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
  approve(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.verificationService.approveRequest(
      user,
      id,
      this.auditCtx(user, req),
    );
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVerificationRequestDto,
    @Req() req: Request,
  ) {
    return this.verificationService.rejectRequest(
      user,
      id,
      dto.reason,
      this.auditCtx(user, req),
    );
  }

  @Patch(':id/review')
  markReview(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.verificationService.markUnderReview(
      user,
      id,
      this.auditCtx(user, req),
    );
  }

  @Patch(':id/documents/:documentId')
  reviewDocument(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: ReviewVerificationDocumentDto,
    @Req() req: Request,
  ) {
    return this.verificationService.reviewDocument(
      user,
      id,
      documentId,
      dto,
      this.auditCtx(user, req),
    );
  }
}
