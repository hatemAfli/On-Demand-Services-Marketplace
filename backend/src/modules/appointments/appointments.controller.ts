import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppointmentStatus, UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppointmentsService } from './appointments.service';
import { ClientRespondRescheduleDto } from './dto/client-respond-reschedule.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ExecutionActionDto } from './dto/execution-action.dto';
import { RespondAppointmentDto } from './dto/respond-appointment.dto';

class CancelAppointmentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

enum ClientConfirmType {
  START = 'START',
  END = 'END',
}

class ClientConfirmDto {
  @IsEnum(ClientConfirmType)
  type!: ClientConfirmType;
}

type AuthUser = { id: string; role: UserRole };

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles(UserRole.CLIENT)
  createAppointment(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.createAppointment(user.id, dto);
  }

  @Get('me/client')
  @Roles(UserRole.CLIENT)
  getMyAppointmentsAsClient(
    @CurrentUser() user: AuthUser,
    @Query('status', new ParseEnumPipe(AppointmentStatus, { optional: true }))
    status?: AppointmentStatus,
  ) {
    return this.appointmentsService.getMyAppointmentsAsClient(user.id, status);
  }

  @Get('me/provider')
  @Roles(UserRole.PROVIDER)
  getMyAppointmentsAsProvider(
    @CurrentUser() user: AuthUser,
    @Query('status', new ParseEnumPipe(AppointmentStatus, { optional: true }))
    status?: AppointmentStatus,
  ) {
    return this.appointmentsService.getMyAppointmentsAsProvider(user.id, status);
  }

  @Get('calendar')
  @Roles(UserRole.PROVIDER)
  getProviderCalendar(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.appointmentsService.getProviderCalendar(user.id, from, to);
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.PROVIDER)
  getAppointmentById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.appointmentsService.getAppointmentById(id, user.id);
  }

  @Patch(':id/respond')
  @Roles(UserRole.PROVIDER)
  providerRespond(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RespondAppointmentDto,
  ) {
    return this.appointmentsService.providerRespond(id, user.id, dto);
  }

  @Patch(':id/client-respond')
  @Roles(UserRole.CLIENT)
  clientRespondReschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ClientRespondRescheduleDto,
  ) {
    return this.appointmentsService.clientRespondReschedule(id, user.id, dto);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.CLIENT, UserRole.PROVIDER)
  cancelAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelAppointmentDto,
  ) {
    const role = user.role === UserRole.CLIENT ? 'CLIENT' : 'PROVIDER';
    return this.appointmentsService.cancelAppointment(id, user.id, role, dto.reason);
  }

  @Patch(':id/execution')
  @Roles(UserRole.PROVIDER)
  recordExecution(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ExecutionActionDto,
  ) {
    return this.appointmentsService.recordExecution(id, user.id, dto);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.CLIENT)
  clientConfirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: ClientConfirmDto,
  ) {
    return this.appointmentsService.clientConfirm(id, user.id, body.type);
  }
}
