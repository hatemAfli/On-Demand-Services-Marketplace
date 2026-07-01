import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SearchGivenServicesDto } from '../../search/dto/search-given-services.dto';

export class ChatbotServiceDto {
  @IsIn(['search', 'resolve-service'])
  action!: 'search' | 'resolve-service';

  @ValidateIf((o: ChatbotServiceDto) => o.action === 'search')
  @ValidateNested()
  @Type(() => SearchGivenServicesDto)
  search?: SearchGivenServicesDto;

  @ValidateIf((o: ChatbotServiceDto) => o.action === 'resolve-service')
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
