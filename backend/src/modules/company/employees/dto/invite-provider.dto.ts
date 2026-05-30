import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator'

export class InviteProviderDto {
  @IsEmail()
  email: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string
}
