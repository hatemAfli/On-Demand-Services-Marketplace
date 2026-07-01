import { Module } from '@nestjs/common';
import { RedisModule } from '../../config/redis.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../search/search.module';
import { ServicesModule } from '../services/services.module';
import { ClientHomeService } from './client-home.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [AccountsModule, AuthModule, RedisModule, SearchModule, ServicesModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientHomeService],
})
export class ClientsModule {}

