import { Module } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.config';
import { AccountsModule } from '../accounts/accounts.module';
import { PrismaModule } from '../../config/prisma.module';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

@Module({
  imports: [PrismaModule, AccountsModule],
  controllers: [ProvidersController],
  providers: [ProvidersService, SupabaseService],
})
export class ProvidersModule {}
