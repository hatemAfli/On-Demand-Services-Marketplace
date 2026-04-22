import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminServiceCategoriesController } from './admin-service-categories.controller';
import { ServiceCategoriesController } from './service-categories.controller';
import { ServiceCategoriesService } from './service-categories.service';

@Module({
  imports: [AuthModule],
  controllers: [ServiceCategoriesController, AdminServiceCategoriesController],
  providers: [ServiceCategoriesService],
  exports: [ServiceCategoriesService],
})
export class ServiceCategoriesModule {}
