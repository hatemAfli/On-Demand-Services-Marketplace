import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [AccountsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}

