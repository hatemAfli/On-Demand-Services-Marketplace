import { IsArray, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateProviderServiceGalleryDto {
  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  @MaxLength(2048, { each: true })
  imageUrls!: string[];
}
