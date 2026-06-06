import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { InvitationStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { clientIp } from '../../../common/utils/client-ip';
import { GetEmployeesDto } from './dto/get-employees.dto';
import { InviteProviderDto } from './dto/invite-provider.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';
import { EmployeesService } from './employees.service';

type AuthUser = { id: string; role: UserRole };

// ─── Company admin endpoints ───────────────────────────────────────────────────
@Controller('company/employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  getCompanyEmployees(
    @CurrentUser() user: AuthUser,
    @Query() dto: GetEmployeesDto,
  ) {
    return this.employeesService.getCompanyEmployees(user.id, dto);
  }

  // Static routes must be declared before the ':providerId' wildcard.
  @Get('lookup')
  lookupProviderByEmail(@Query('email') email: string) {
    return this.employeesService.lookupProviderByEmail(email);
  }

  @Get('invitations')
  getMyInvitations(
    @CurrentUser() user: AuthUser,
    @Query('status', new ParseEnumPipe(InvitationStatus, { optional: true }))
    status?: InvitationStatus,
  ) {
    return this.employeesService.getMyInvitations(user.id, status);
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  sendInvitation(
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteProviderDto,
    @Req() req: Request,
  ) {
    return this.employeesService.sendInvitation(user.id, dto, clientIp(req));
  }

  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelInvitation(
    @CurrentUser() user: AuthUser,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @Req() req: Request,
  ) {
    return this.employeesService.cancelInvitation(user.id, invitationId, clientIp(req));
  }

  @Get(':providerId')
  getEmployeeById(
    @CurrentUser() user: AuthUser,
    @Param('providerId', ParseUUIDPipe) providerId: string,
  ) {
    return this.employeesService.getEmployeeById(user.id, providerId);
  }

  @Delete(':providerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEmployee(
    @CurrentUser() user: AuthUser,
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Req() req: Request,
  ) {
    return this.employeesService.removeEmployee(user.id, providerId, clientIp(req));
  }
}

// ─── Provider endpoints (receiving invitations) ────────────────────────────────
@Controller('provider/invitations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PROVIDER)
export class ProviderInvitationsController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  getMyReceivedInvitations(
    @CurrentUser() user: AuthUser,
    @Query('filter') filter?: string,
  ) {
    const normalized =
      filter === 'all' || filter === 'pending' || filter === 'cancelled'
        ? filter
        : 'pending';
    return this.employeesService.getMyReceivedInvitations(user.id, normalized);
  }

  @Patch(':invitationId/respond')
  @HttpCode(HttpStatus.OK)
  respondToInvitation(
    @CurrentUser() user: AuthUser,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @Body() dto: RespondInvitationDto,
  ) {
    return this.employeesService.respondToInvitation(user.id, invitationId, dto);
  }
}
