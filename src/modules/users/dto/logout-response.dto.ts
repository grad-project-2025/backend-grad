import { ApiProperty } from '@nestjs/swagger';

export class LogoutData {
  @ApiProperty({ example: 'User logged out successfully' })
  message: string;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: LogoutData })
  data: LogoutData;
}
