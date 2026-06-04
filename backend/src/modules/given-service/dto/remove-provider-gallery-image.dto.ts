import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RemoveProviderGalleryImageDto {
  @IsString()
  @MaxLength(2048)
  imageUrl!: string;

  @IsOptional()
  @IsUUID()
  galleryId?: string;
}
