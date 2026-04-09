import { IsOptional, IsString } from 'class-validator';
import { UpdateUserIdentityDto } from '../../accounts/dto/update-user-identity.dto';

export class UpdateClientDto extends UpdateUserIdentityDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

