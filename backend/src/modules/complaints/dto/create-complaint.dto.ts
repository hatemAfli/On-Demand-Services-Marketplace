import { ComplaintCategory, ComplaintForwardTarget } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateComplaintDto {
  @IsUUID()
  appointmentId!: string;

  @IsEnum(ComplaintCategory)
  category!: ComplaintCategory;

  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  evidenceUrls?: string[];

  /** Required when the reported provider is a company employee. */
  @IsOptional()
  @IsEnum(ComplaintForwardTarget)
  forwardTarget?: ComplaintForwardTarget;
}
