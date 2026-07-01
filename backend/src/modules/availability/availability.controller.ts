import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AvailabilityService } from './availability.service';
import { CreateDayOffDto } from './dto/day-off.dto';
import { UpsertAvailabilityBulkDto } from './dto/upsert-availability.dto';

type AuthUser = { id: string };

@Controller('availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Patch('me')
  @Roles(UserRole.PROVIDER)
  upsertAvailability(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertAvailabilityBulkDto,
  ) {
    return this.availabilityService.upsertAvailability(user.id, dto);
  }

  @Get('me')
  @Roles(UserRole.PROVIDER)
  getMyAvailability(@CurrentUser() user: AuthUser) {
    return this.availabilityService.getMyAvailability(user.id);
  }

  @Post('days-off')
  @Roles(UserRole.PROVIDER)
  createDayOff(@CurrentUser() user: AuthUser, @Body() dto: CreateDayOffDto) {
    return this.availabilityService.createDayOff(user.id, dto);
  }

  @Delete('days-off/:id')
  @Roles(UserRole.PROVIDER)
  deleteDayOff(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.availabilityService.deleteDayOff(user.id, id);
  }

  @Get('days-off/me')
  @Roles(UserRole.PROVIDER)
  getMyDaysOff(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.availabilityService.getMyDaysOff(user.id, from, to);
  }

  /** Provider reschedule: real calendar slots (includes pending holds). */
  @Get('me/slots')
  @Roles(UserRole.PROVIDER)
  getMyDaySlots(
    @CurrentUser() user: AuthUser,
    @Query('date') date: string,
    @Query('duration', ParseIntPipe) duration: number,
    @Query('excludeAppointmentId') excludeAppointmentId?: string,
  ) {
    return this.availabilityService.getProviderDaySlots(
      user.id,
      date,
      duration,
      {
        excludeAppointmentId,
        includePendingHolds: true,
      },
    );
  }

  @Get(':providerId/days-off')
  @Roles(UserRole.CLIENT)
  getProviderDaysOff(
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.availabilityService.getProviderDaysOff(providerId, from, to);
  }

  @Get(':providerId/slots')
  @Roles(UserRole.CLIENT)
  getAvailableSlots(
    @Param('providerId', ParseUUIDPipe) providerId: string,
    @Query('date') date: string,
    @Query('duration', ParseIntPipe) duration: number,
  ) {
    return this.availabilityService.getProviderDaySlots(
      providerId,
      date,
      duration,
    );
  }
}
