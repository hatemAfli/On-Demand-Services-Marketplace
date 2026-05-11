import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GivenServiceService } from './given-service.service';

@Controller('given-services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class GivenServicePublicController {
  constructor(private readonly givenServiceService: GivenServiceService) {}

  @Get(':givenServiceId')
  getGivenServiceForClient(
    @Param('givenServiceId', new ParseUUIDPipe()) givenServiceId: string,
    @Query('locale') locale?: string,
  ) {
    return this.givenServiceService.getGivenServiceForClient(
      givenServiceId,
      locale,
    );
  }
}
