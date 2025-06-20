import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendEmailVerificationDto {
  @ApiProperty({
    example: 'user1@example.com',
    description: 'Email of the user to resend verification',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
