import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export enum ExecutionAction {
  EN_ROUTE = 'EN_ROUTE',
  START = 'START',
  END = 'END',
}

export class ExecutionActionDto {
  @IsEnum(ExecutionAction)
  action!: ExecutionAction;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}
