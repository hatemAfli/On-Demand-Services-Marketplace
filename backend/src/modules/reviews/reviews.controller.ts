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
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { GetProviderReviewsDto } from './dto/get-provider-reviews.dto';
import { ReplyToReviewDto } from './dto/reply-to-review.dto';
import { ReviewsService } from './reviews.service';

type RequestUser = { id: string; role: UserRole };

@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @Roles(UserRole.CLIENT)
  @HttpCode(HttpStatus.CREATED)
  createReview(
    @Req() req: Request & { user: RequestUser },
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(req.user.id, dto);
  }

  @Patch(':id/reply')
  @Roles(UserRole.PROVIDER)
  replyToReview(
    @Req() req: Request & { user: RequestUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReplyToReviewDto,
  ) {
    return this.reviewsService.replyToReview(req.user.id, id, dto);
  }

  /** Public listing — no JWT required. */
  @Public()
  @Get('provider/:providerId/breakdown')
  getRatingsBreakdown(
    @Param('providerId', new ParseUUIDPipe()) providerId: string,
  ) {
    return this.reviewsService.getRatingsBreakdown(providerId);
  }

  /** Public listing — no JWT required. */
  @Public()
  @Get('provider/:providerId')
  getProviderReviews(
    @Param('providerId', new ParseUUIDPipe()) providerId: string,
    @Query() dto: GetProviderReviewsDto,
  ) {
    return this.reviewsService.getProviderReviews({
      ...dto,
      providerId,
    });
  }

  @Get('can-review/:appointmentId')
  @Roles(UserRole.CLIENT)
  checkCanReview(
    @Req() req: Request & { user: RequestUser },
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
  ) {
    return this.reviewsService.checkCanReview(req.user.id, appointmentId);
  }
}
