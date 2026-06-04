import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CompanyAppointmentsService } from './company-appointments.service';
import { AssignProviderDto } from './dto/assign-provider.dto';
import { GetRescheduleOptionsDto } from './dto/get-reschedule-options.dto';
import { ListCompanyAppointmentsDto } from './dto/list-company-appointments.dto';
import { RespondCompanyAppointmentDto } from './dto/respond-company-appointment.dto';

type AuthUser = { id: string; role: UserRole };

@Controller('company/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN)
export class CompanyAppointmentsController {
  constructor(
    private readonly service: CompanyAppointmentsService,
  ) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser) {
    return this.service.getStats(user.id);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() dto: ListCompanyAppointmentsDto,
  ) {
    return this.service.list(user.id, dto);
  }

  @Get(':id/available-providers')
  getAvailableProviders(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.getAvailableProviders(user.id, id);
  }

  @Get(':id/reschedule-options')
  getRescheduleOptions(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() dto: GetRescheduleOptionsDto,
  ) {
    return this.service.getRescheduleOptions(user.id, id, dto);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.getById(user.id, id);
  }

  @Patch(':id/respond')
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RespondCompanyAppointmentDto,
  ) {
    return this.service.respond(user.id, id, dto);
  }

  @Patch(':id/assign')
  assignProvider(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignProviderDto,
  ) {
    return this.service.assignProvider(user.id, id, dto);
  }
}
