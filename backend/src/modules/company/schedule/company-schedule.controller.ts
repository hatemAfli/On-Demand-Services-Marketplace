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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { clientIp } from '../../../common/utils/client-ip';
import { CreateDayOffDto } from '../../availability/dto/day-off.dto';
import { UpsertAvailabilityBulkDto } from '../../availability/dto/upsert-availability.dto';
import { CompanyScheduleService } from './company-schedule.service';
import { GetCompanyScheduleDto } from './dto/get-company-schedule.dto';

type AuthUser = { id: string; role: UserRole };

@Controller('company/schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN)
export class CompanyScheduleController {
  constructor(private readonly service: CompanyScheduleService) {}

  @Get()
  getDaySchedule(
    @CurrentUser() user: AuthUser,
    @Query() dto: GetCompanyScheduleDto,
  ) {
    return this.service.getDaySchedule(user.id, dto);
  }

  @Get('employees/:providerId/availability')
  getEmployeeAvailability(
    @CurrentUser() user: AuthUser,
    @Param('providerId', ParseUUIDPipe) providerId: string,
  ) {
    return this.service.getEmployeeAvailability(user.id, providerId);
  }

  @Patch('employees/:providerId/availability')
  upsertEmployeeAvailability(
    @CurrentUser() user: AuthUser,
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Body() dto: UpsertAvailabilityBulkDto,
    @Req() req: Request,
  ) {
    return this.service.upsertEmployeeAvailability(
      user.id,
      providerId,
      dto,
      clientIp(req),
    );
  }

  @Get('employees/:providerId/days-off')
  getEmployeeDaysOff(
    @CurrentUser() user: AuthUser,
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getEmployeeDaysOff(user.id, providerId, from, to);
  }

  @Post('employees/:providerId/days-off')
  createEmployeeDayOff(
    @CurrentUser() user: AuthUser,
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Body() dto: CreateDayOffDto,
    @Req() req: Request,
  ) {
    return this.service.createEmployeeDayOff(user.id, providerId, dto, clientIp(req));
  }

  @Delete('employees/:providerId/days-off/:dayOffId')
  deleteEmployeeDayOff(
    @CurrentUser() user: AuthUser,
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Param('dayOffId', ParseUUIDPipe) dayOffId: string,
    @Req() req: Request,
  ) {
    return this.service.deleteEmployeeDayOff(
      user.id,
      providerId,
      dayOffId,
      clientIp(req),
    );
  }
}
