import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { clientIp } from '../../common/utils/client-ip';
import { AddLegalDocumentVersionDto } from './dto/add-legal-document-version.dto';
import { CreateLegalDocumentDto } from './dto/create-legal-document.dto';
import { PatchLegalDocumentVersionDto } from './dto/patch-legal-document-version.dto';
import { UpdateLegalDocumentDto } from './dto/update-legal-document.dto';
import { LegalDocumentsService } from './legal-documents.service';

@Controller('admin/legal-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminLegalDocumentsController {
  constructor(private readonly service: LegalDocumentsService) {}

  private auditCtx(user: User, req: Request) {
    return { actorAdminId: user.id, ipAddress: clientIp(req) };
  }

  @Get()
  list(@CurrentUser() _user: User) {
    return this.service.listForAdmin();
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateLegalDocumentDto,
    @Req() req: Request,
  ) {
    return this.service.create(dto, user.id, this.auditCtx(user, req));
  }

  @Patch(':documentId')
  updateDocument(
    @CurrentUser() user: User,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateLegalDocumentDto,
    @Req() req: Request,
  ) {
    return this.service.updateDocument(
      documentId,
      dto,
      this.auditCtx(user, req),
    );
  }

  @Post(':documentId/versions')
  addVersion(
    @CurrentUser() user: User,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: AddLegalDocumentVersionDto,
    @Req() req: Request,
  ) {
    return this.service.addVersion(
      documentId,
      dto,
      user.id,
      this.auditCtx(user, req),
    );
  }

  @Patch(':documentId/versions/:versionId')
  patchVersion(
    @CurrentUser() user: User,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: PatchLegalDocumentVersionDto,
    @Req() req: Request,
  ) {
    return this.service.patchVersion(
      documentId,
      versionId,
      dto,
      user.id,
      this.auditCtx(user, req),
    );
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: User,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: Request,
  ) {
    await this.service.remove(documentId, this.auditCtx(user, req));
  }
}
