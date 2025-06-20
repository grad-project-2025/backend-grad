import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'your-refresh-token-here',
    description: 'Refresh token to obtain a new access token',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
