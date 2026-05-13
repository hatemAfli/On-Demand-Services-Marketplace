import { IsUUID } from 'class-validator';

export class MarkConversationReadDto {
  @IsUUID()
  conversationId!: string;
}
