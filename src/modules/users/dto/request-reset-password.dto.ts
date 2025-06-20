import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestResetPasswordDto {
  @ApiProperty({
    example: 'user1@example.com',
    description: 'Email of the user to request password reset',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
