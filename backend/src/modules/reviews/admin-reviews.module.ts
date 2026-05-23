import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminReviewsController } from './admin-reviews.controller';
import { AdminReviewsService } from './admin-reviews.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [AdminReviewsController],
  providers: [AdminReviewsService],
  exports: [AdminReviewsService],
})
export class AdminReviewsModule {}
