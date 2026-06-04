import {
  BadRequestException,
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
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AddGalleryImageDto } from './dto/add-gallery-image.dto';
import { UpdateGivenServiceDto } from './dto/update-given-service.dto';
import type { GalleryUploadFile } from './gallery-upload-file.type';
import { CompanyServicesService } from './company-services.service';

type AuthUser = { id: string; role: UserRole };

@Controller('company/services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN)
export class CompanyServicesController {
  constructor(
    private readonly companyServicesService: CompanyServicesService,
  ) {}

  // GET /company/services
  @Get()
  getCompanyServices(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('active') active?: string,
  ) {
    const activeBool =
      active === 'true' ? true : active === 'false' ? false : undefined;
    return this.companyServicesService.getCompanyServices(user.id, {
      search,
      categoryId,
      active: activeBool,
    });
  }

  // GET /company/services/categories  — must be before /:serviceId
  @Get('categories')
  getCompanyCategories(@CurrentUser() user: AuthUser) {
    return this.companyServicesService.getCompanyCategories(user.id);
  }

  // GET /company/services/given/:givenServiceId  — must be before /:serviceId
  @Get('given/:givenServiceId')
  getGivenServiceForEdit(
    @CurrentUser() user: AuthUser,
    @Param('givenServiceId', ParseUUIDPipe) givenServiceId: string,
  ) {
    return this.companyServicesService.getGivenServiceForEdit(
      user.id,
      givenServiceId,
    );
  }

  // GET /company/services/:serviceId
  @Get(':serviceId')
  getCompanyServiceDetail(
    @CurrentUser() user: AuthUser,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.companyServicesService.getCompanyServiceDetail(
      user.id,
      serviceId,
    );
  }

  // PATCH /company/services/given/:givenServiceId
  @Patch('given/:givenServiceId')
  updateGivenService(
    @CurrentUser() user: AuthUser,
    @Param('givenServiceId', ParseUUIDPipe) givenServiceId: string,
    @Body() dto: UpdateGivenServiceDto,
  ) {
    return this.companyServicesService.updateGivenService(
      user.id,
      givenServiceId,
      dto,
    );
  }

  // PATCH /company/services/given/:givenServiceId/toggle
  @Patch('given/:givenServiceId/toggle')
  @HttpCode(HttpStatus.OK)
  toggleGivenServiceActive(
    @CurrentUser() user: AuthUser,
    @Param('givenServiceId', ParseUUIDPipe) givenServiceId: string,
    @Body('active') active: boolean,
  ) {
    return this.companyServicesService.toggleGivenServiceActive(
      user.id,
      givenServiceId,
      active,
    );
  }

  // POST /company/services/given/:givenServiceId/gallery/upload  → 201
  @Post('given/:givenServiceId/gallery/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  uploadGalleryImage(
    @CurrentUser() user: AuthUser,
    @Param('givenServiceId', ParseUUIDPipe) givenServiceId: string,
    @UploadedFile() file?: GalleryUploadFile,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required.');
    }
    const allowed = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]);
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, WebP, and GIF images are allowed.',
      );
    }
    return this.companyServicesService.uploadGalleryImage(
      user.id,
      givenServiceId,
      file,
    );
  }

  // POST /company/services/given/:givenServiceId/gallery  → 201
  @Post('given/:givenServiceId/gallery')
  @HttpCode(HttpStatus.CREATED)
  addGalleryImage(
    @CurrentUser() user: AuthUser,
    @Param('givenServiceId', ParseUUIDPipe) givenServiceId: string,
    @Body() dto: AddGalleryImageDto,
  ) {
    return this.companyServicesService.addGalleryImage(
      user.id,
      givenServiceId,
      dto.imageUrl,
    );
  }

  // DELETE /company/services/gallery/:galleryId  → 204
  @Delete('gallery/:galleryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGalleryImage(
    @CurrentUser() user: AuthUser,
    @Param('galleryId', ParseUUIDPipe) galleryId: string,
  ) {
    return this.companyServicesService.removeGalleryImage(user.id, galleryId);
  }
}
