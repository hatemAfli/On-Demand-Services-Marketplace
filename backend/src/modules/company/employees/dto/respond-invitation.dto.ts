import { IsEnum } from 'class-validator'

export class RespondInvitationDto {
  @IsEnum(['ACCEPTED', 'DECLINED'])
  action: 'ACCEPTED' | 'DECLINED'
}
