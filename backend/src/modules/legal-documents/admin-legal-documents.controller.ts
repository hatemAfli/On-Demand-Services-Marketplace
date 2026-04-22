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
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AddLegalDocumentVersionDto } from './dto/add-legal-document-version.dto';
import { CreateLegalDocumentDto } from './dto/create-legal-document.dto';
import { PatchLegalDocumentVersionDto } from './dto/patch-legal-document-version.dto';
import { UpdateLegalDocumentDto } from './dto/update-legal-document.dto';
import { LegalDocumentsService } from './legal-documents.service';

/**
 * Platform admin — manage `LegalDocument` + versioned markdown.
 *
 * | Method | Path | Notes |
 * |--------|------|--------|
 * | POST | /api/admin/legal-documents | Create shell + version 1; optional `publish` |
 * | PATCH | /api/admin/legal-documents/:documentId | Update title |
 * | POST | /api/admin/legal-documents/:documentId/versions | New version; optional `publish` (archives prior published) |
 * | PATCH | /api/admin/legal-documents/:documentId/versions/:versionId | Edit draft body and/or `publish: true` |
 * | DELETE | /api/admin/legal-documents/:documentId | Remove document and all versions |
 */
@Controller('admin/legal-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminLegalDocumentsController {
  constructor(private readonly service: LegalDocumentsService) {}

  @Get()
  list(@CurrentUser() _user: User) {
    return this.service.listForAdmin();
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateLegalDocumentDto,
  ) {
    return this.service.create(dto, user.id);
  }

  @Patch(':documentId')
  updateDocument(
    @CurrentUser() _user: User,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateLegalDocumentDto,
  ) {
    return this.service.updateDocument(documentId, dto);
  }

  @Post(':documentId/versions')
  addVersion(
    @CurrentUser() user: User,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: AddLegalDocumentVersionDto,
  ) {
    return this.service.addVersion(documentId, dto, user.id);
  }

  @Patch(':documentId/versions/:versionId')
  patchVersion(
    @CurrentUser() user: User,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: PatchLegalDocumentVersionDto,
  ) {
    return this.service.patchVersion(documentId, versionId, dto, user.id);
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() _user: User,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    await this.service.remove(documentId);
  }
}
