import { FavoriteType } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreateClientFavoriteDto {
  @IsEnum(FavoriteType)
  type!: FavoriteType;

  @IsUUID()
  targetId!: string;
}
