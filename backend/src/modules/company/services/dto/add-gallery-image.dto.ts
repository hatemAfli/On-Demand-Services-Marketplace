import { IsString, IsUrl } from 'class-validator';

export class AddGalleryImageDto {
  @IsString()
  @IsUrl()
  imageUrl: string;
}
