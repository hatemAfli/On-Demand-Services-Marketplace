import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateProviderGivenServiceDto } from './dto/update-provider-given-service.dto';
import { GivenServiceService } from './given-service.service';

/**
 * Provider-owned catalog offers (`GivenService`), keyed by catalog `serviceId`.
 * Dedicated controller path avoids nesting issues under `providers` only routes.
 */
@Controller('providers/me/given-services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PROVIDER)
export class GivenServiceController {
  constructor(private readonly givenServiceService: GivenServiceService) {}

  @Get(':serviceId')
  getProviderGivenService(
    @CurrentUser() user: { id: string },
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
  ) {
    return this.givenServiceService.getProviderGivenService(user.id, serviceId);
  }

  @Patch(':serviceId')
  updateProviderGivenService(
    @CurrentUser() user: { id: string },
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Body() dto: UpdateProviderGivenServiceDto,
  ) {
    return this.givenServiceService.updateProviderGivenService(
      user.id,
      serviceId,
      dto,
    );
  }
}
