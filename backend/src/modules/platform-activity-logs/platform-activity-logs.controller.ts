import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { clientIp } from '../../common/utils/client-ip';
import { ListPlatformActivityLogsDto } from './dto/list-platform-activity-logs.dto';
import { PlatformActivityLogsService } from './platform-activity-logs.service';

type RequestUser = { id: string; role: UserRole };

@Controller('admin/activity-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class PlatformActivityLogsController {
  constructor(private readonly service: PlatformActivityLogsService) {}

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Get()
  list(@Query() dto: ListPlatformActivityLogsDto) {
    return this.service.list(dto);
  }

  @Get('export')
  async exportCsv(
    @Req() req: Request & { user: RequestUser },
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv({
      actorAdminId: req.user.id,
      ipAddress: clientIp(req),
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="platform-activity-logs.csv"',
    );
    res.send(csv);
  }
}
