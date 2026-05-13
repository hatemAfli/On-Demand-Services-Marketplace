import { IsUUID } from 'class-validator';

export class OpenOrCreateConversationDto {
  /**
   * Client: provider user id. Provider: client profile id (`clients.id`).
   * The authenticated user is always the other party.
   */
  @IsUUID()
  counterpartId!: string;
}
