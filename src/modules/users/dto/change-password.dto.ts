import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPasssssword12@@' })
  @IsString()
  @MinLength(10, { message: 'Old password must be at least 10 characters' })
  oldPassword: string;

  @ApiProperty({ example: 'NewPasssssword12@@' })
  @IsStrongPassword(
    { minSymbols: 1, minNumbers: 1, minLowercase: 1, minUppercase: 1 },
    {
      message:
        'New password must contain at least: 1 uppercase letter, 1 lowercase letter, 1 number, and 1 symbol',
    },
  )
  @MinLength(10, { message: 'New password must be at least 10 characters' })
  newPassword: string;
}
