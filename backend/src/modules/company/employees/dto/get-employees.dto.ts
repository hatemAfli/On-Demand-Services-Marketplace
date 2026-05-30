import { AccountStatus } from '@prisma/client'
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'

export class GetEmployeesDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus

  @IsOptional()
  @IsIn(['recent', 'name_asc', 'name_desc', 'rating_desc'])
  sort?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  take?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number
}
