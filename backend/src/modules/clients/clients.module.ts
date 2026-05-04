import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [AccountsModule, AuthModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}

