import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { clientIp } from '../../common/utils/client-ip';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { GetComplaintsDto } from './dto/get-complaints.dto';
import { ReviewComplaintDto } from './dto/review-complaint.dto';
import { WithdrawComplaintDto } from './dto/withdraw-complaint.dto';

type RequestUser = { id: string; role: UserRole };

@Controller('complaints')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  @Roles(UserRole.CLIENT)
  @HttpCode(HttpStatus.CREATED)
  createComplaint(
    @Req() req: Request & { user: RequestUser },
    @Body() dto: CreateComplaintDto,
  ) {
    return this.complaintsService.createComplaint(req.user.id, dto);
  }

  @Get('me')
  @Roles(UserRole.CLIENT)
  getMyComplaints(@Req() req: Request & { user: RequestUser }) {
    return this.complaintsService.getMyComplaints(req.user.id);
  }

  @Get('my-provider-complaints')
  @Roles(UserRole.PROVIDER)
  getMyProviderComplaints(@Req() req: Request & { user: RequestUser }) {
    return this.complaintsService.getMyProviderComplaints(req.user.id);
  }

  @Get()
  @Roles(UserRole.PLATFORM_ADMIN)
  getAllComplaints(@Query() dto: GetComplaintsDto) {
    return this.complaintsService.getAllComplaints(dto);
  }

  @Get('stats')
  @Roles(UserRole.PLATFORM_ADMIN)
  getComplaintStats() {
    return this.complaintsService.getComplaintStats();
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.PLATFORM_ADMIN)
  getComplaintById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.complaintsService.getComplaintById(id, req.user.id);
  }

  @Patch(':id/withdraw')
  @Roles(UserRole.CLIENT)
  withdrawComplaint(
    @Req() req: Request & { user: RequestUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: WithdrawComplaintDto,
  ) {
    return this.complaintsService.withdrawComplaint(req.user.id, id, dto);
  }

  @Patch(':id/review')
  @Roles(UserRole.PLATFORM_ADMIN)
  reviewComplaint(
    @Req() req: Request & { user: RequestUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewComplaintDto,
  ) {
    return this.complaintsService.reviewComplaint(req.user.id, id, dto, {
      actorAdminId: req.user.id,
      ipAddress: clientIp(req),
    });
  }
}
