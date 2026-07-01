import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';

@Module({
  imports: [AccountsModule],
  controllers: [AdminsController],
  providers: [AdminsService],
})
export class AdminsModule {}
