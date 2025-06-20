import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenData {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4=' })
  refreshToken: string;
}

export class RefreshTokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: RefreshTokenData })
  data: RefreshTokenData;
}
