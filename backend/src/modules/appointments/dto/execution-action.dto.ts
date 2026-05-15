import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

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
  @ArrayMaxSize(10)
  @IsString({ each: true })
  photoUrls?: string[];
}
