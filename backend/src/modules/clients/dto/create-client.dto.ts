import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { UpdateUserIdentityDto } from '../../accounts/dto/update-user-identity.dto';

export class CreateClientDto extends UpdateUserIdentityDto {
  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

