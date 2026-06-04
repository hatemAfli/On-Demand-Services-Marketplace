import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CompanySettingsService } from './company-settings.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { UpdateCompanyBrandingDto } from './dto/update-company-branding.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { UpsertBranchDto } from './dto/upsert-branch.dto';

type AuthUser = { id: string; role: UserRole };

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  return req.ip;
}

@Controller('company/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN)
export class CompanySettingsController {
  constructor(private readonly service: CompanySettingsService) {}

  @Get()
  getSettings(@CurrentUser() user: AuthUser) {
    return this.service.getSettings(user.id);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCompanyProfileDto,
    @Req() req: Request,
  ) {
    return this.service.updateProfile(user.id, dto, clientIp(req));
  }

  @Patch('branding')
  updateBranding(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCompanyBrandingDto,
    @Req() req: Request,
  ) {
    return this.service.updateBranding(user.id, dto, clientIp(req));
  }

  @Get('branches')
  listBranches(@CurrentUser() user: AuthUser) {
    return this.service.listBranches(user.id);
  }

  @Post('branches')
  createBranch(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertBranchDto,
    @Req() req: Request,
  ) {
    return this.service.createBranch(user.id, dto, clientIp(req));
  }

  @Patch('branches/:id')
  updateBranch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertBranchDto,
    @Req() req: Request,
  ) {
    return this.service.updateBranch(user.id, id, dto, clientIp(req));
  }

  @Delete('branches/:id')
  deleteBranch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.service.deleteBranch(user.id, id, clientIp(req));
  }

  @Patch('notifications')
  updateNotifications(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationsDto,
    @Req() req: Request,
  ) {
    return this.service.updateNotifications(user.id, dto, clientIp(req));
  }

  @Get('audit-logs')
  listAuditLogs(
    @CurrentUser() user: AuthUser,
    @Query() dto: ListAuditLogsDto,
  ) {
    return this.service.listAuditLogs(user.id, dto);
  }

  @Get('export/providers')
  async exportProviders(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportProvidersCsv(user.id, clientIp(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="company-providers.csv"',
    );
    res.send(csv);
  }

  @Get('export/orders')
  async exportOrders(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportOrdersCsv(user.id, clientIp(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="company-orders.csv"',
    );
    res.send(csv);
  }

  @Get('export/summary')
  async exportSummary(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportSummaryCsv(user.id, clientIp(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="company-summary.csv"',
    );
    res.send(csv);
  }

  @Get('export/audit-logs')
  async exportAuditLogs(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportAuditLogsCsv(user.id, clientIp(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="company-audit-logs.csv"',
    );
    res.send(csv);
  }
}
