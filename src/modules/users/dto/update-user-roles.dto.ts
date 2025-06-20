import {
  IsEnum,
  ArrayNotEmpty,
  ArrayUnique,
  IsString,
  IsNotEmpty,
  IsEmail,
} from 'class-validator';
import { Role } from 'src/common/enums/role.enum';

export class UpdateUserRolesDto {
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(Role, {
    each: true,
    message: 'Each role must be either admin, mod, or user',
  })
  roles: Role[];
  @IsString()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
