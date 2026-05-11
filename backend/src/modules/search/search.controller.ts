import { Controller, Get, HttpCode, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SearchGivenServicesDto } from './dto/search-given-services.dto';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('providers')
  @HttpCode(200)
  search(@Query() dto: SearchGivenServicesDto) {
    return this.searchService.search(dto);
  }
}
