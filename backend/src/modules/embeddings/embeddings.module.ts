import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EmbeddingsService } from './embeddings.service';

@Module({
  imports: [HttpModule],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
