import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../config/prisma.module';
import { CompanyReviewsController } from './company-reviews.controller';
import { CompanyReviewsService } from './company-reviews.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyReviewsController],
  providers: [CompanyReviewsService],
  exports: [CompanyReviewsService],
})
export class CompanyReviewsModule {}
