import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'sendMessageHasTextOrMedia', async: false })
class SendMessageHasTextOrMediaConstraint implements ValidatorConstraintInterface {
  validate(_conversationId: string, args: ValidationArguments): boolean {
    const o = args.object as SendMessageDto;
    const text = o.text?.trim() ?? '';
    const urls =
      o.mediaUrls?.filter((u) => typeof u === 'string' && u.trim().length > 0) ?? [];
    return text.length > 0 || urls.length > 0;
  }

  defaultMessage(): string {
    return 'Provide non-empty text or at least one media URL';
  }
}

export class SendMessageDto {
  @IsUUID()
  @Validate(SendMessageHasTextOrMediaConstraint)
  conversationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];
}
