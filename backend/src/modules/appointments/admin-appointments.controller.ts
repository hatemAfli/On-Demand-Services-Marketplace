import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { clientIp } from '../../common/utils/client-ip';
import { AdminAppointmentsService } from './admin-appointments.service';
import { GetAdminAppointmentsDto } from './dto/get-admin-appointments.dto';
import { InterveneAppointmentDto } from './dto/intervene-appointment.dto';

type RequestUser = { id: string; role: UserRole };

@Controller('admin/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminAppointmentsController {
  constructor(
    private readonly adminAppointmentsService: AdminAppointmentsService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminAppointmentsService.getStats();
  }

  @Get()
  list(@Query() query: GetAdminAppointmentsDto) {
    return this.adminAppointmentsService.list(query);
  }

  @Get(':id')
  getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminAppointmentsService.getById(id);
  }

  @Patch(':id/flag-disputed')
  flagDisputed(
    @Req() req: Request & { user: RequestUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.adminAppointmentsService.flagAsDisputed(id, {
      actorAdminId: req.user.id,
      ipAddress: clientIp(req),
    });
  }

  @Patch(':id/intervene')
  intervene(
    @Req() req: Request & { user: RequestUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: InterveneAppointmentDto,
  ) {
    return this.adminAppointmentsService.intervene(id, dto, {
      actorAdminId: req.user.id,
      ipAddress: clientIp(req),
    });
  }
}
