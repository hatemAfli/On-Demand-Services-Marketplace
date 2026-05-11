import { IsEnum } from 'class-validator';

export enum ClientRescheduleAction {
  CONFIRMED = 'CONFIRMED',
  CANCELLED_CLIENT = 'CANCELLED_CLIENT',
}

export class ClientRespondRescheduleDto {
  @IsEnum(ClientRescheduleAction)
  action!: ClientRescheduleAction;
}
