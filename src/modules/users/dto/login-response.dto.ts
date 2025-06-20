import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './register-response.dto';

export class LoginResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    type: 'object',
    properties: {
      message: { type: 'string', example: 'User logged in successfully' },
      accessToken: {
        type: 'string',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
      refreshToken: {
        type: 'string',
        example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4=',
      },
    },
  })
  data: {
    message: string;
    accessToken: string;
    refreshToken: string;
  };
}
