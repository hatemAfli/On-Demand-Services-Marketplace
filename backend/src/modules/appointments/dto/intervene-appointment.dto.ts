import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class InterveneAppointmentDto {
  @IsIn(['FORCE_COMPLETE', 'FORCE_CANCEL'])
  action!: 'FORCE_COMPLETE' | 'FORCE_CANCEL';

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
