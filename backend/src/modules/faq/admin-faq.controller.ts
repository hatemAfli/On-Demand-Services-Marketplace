import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateFaqItemDto, UpdateFaqItemDto } from './dto/admin-faq.dto';
import { FaqService } from './faq.service';

@Controller('admin/faq')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminFaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  list() {
    return this.faqService.listForAdmin();
  }

  @Post()
  create(@Body() dto: CreateFaqItemDto) {
    return this.faqService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaqItemDto,
  ) {
    return this.faqService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.faqService.remove(id);
  }
}
