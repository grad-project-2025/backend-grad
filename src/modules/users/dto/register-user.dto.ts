import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsStrongPassword,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { IsValidCountry } from '../../../common/validators/is-valid-country';
import { IsValidPhoneNumber } from '../../../common/validators/is-valid-phone-number';
import { IsAdult } from '../../../common/validators/is-adult';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'Passsssword12@@' })
  @IsStrongPassword(
    { minSymbols: 1, minNumbers: 1, minLowercase: 1, minUppercase: 1 },
    {
      message:
        'Password must contain: 1 uppercase, 1 lowercase, 1 number, 1 symbol',
    },
  )
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  password: string;

  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(3, { message: 'First name must be at least 3 characters' })
  firstName: string;

  @ApiProperty({ example: 'MMM' })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(3, { message: 'Last name must be at least 3 characters' })
  lastName: string;

  @ApiProperty({ example: '+201234567890', required: false })
  @IsString()
  @IsOptional()
  @IsValidPhoneNumber({
    message:
      'Phone number must be a valid international phone number (e.g., +201234567890)',
  })
  phoneNumber?: string;

  @ApiProperty({ example: 'Egypt' })
  @IsString()
  @IsOptional()
  @IsValidCountry({
    message:
      'Country must be a valid country name or ISO 3166-1 alpha-2/alpha-3 code',
  })
  country?: string;

  @IsOptional()
  @IsString()
  birthdate?: string;
}
