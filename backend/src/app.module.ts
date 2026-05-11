import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './config/prisma.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ServicesModule } from './modules/services/services.module';
import { ServiceCategoriesModule } from './modules/service-categories/service-categories.module';
import { VerificationModule } from './modules/verification/verification.module';
import { LegalDocumentsModule } from './modules/legal-documents/legal-documents.module';
import { GivenServiceModule } from './modules/given-service/given-service.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { SearchModule } from './modules/search/search.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    ClientsModule,
    ServicesModule,
    ServiceCategoriesModule,
    VerificationModule,
    LegalDocumentsModule,
    GivenServiceModule,
    AdminUsersModule,
    CompaniesModule,
    ProvidersModule,
    SearchModule,
    FavoritesModule,
    AvailabilityModule,
    AppointmentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*'); // Log all routes
  }
}
