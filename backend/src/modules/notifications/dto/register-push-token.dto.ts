import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';

export enum PushPlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^ExponentPushToken\[.+\]$/, {
    message: 'token must start with "ExponentPushToken["',
  })
  token!: string;

  @IsEnum(PushPlatform)
  platform!: PushPlatform;
}
