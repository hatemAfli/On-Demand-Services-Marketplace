import { IsOptional, IsString } from 'class-validator';
import { UpdateUserIdentityDto } from '../../accounts/dto/update-user-identity.dto';

export class CreateClientDto extends UpdateUserIdentityDto {
  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
