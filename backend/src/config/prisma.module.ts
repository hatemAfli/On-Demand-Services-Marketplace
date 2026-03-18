import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.config';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

