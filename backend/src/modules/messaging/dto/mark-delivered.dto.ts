import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';

export class MarkMessagesDeliveredDto {
  @IsUUID()
  conversationId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  messageIds!: string[];
}
