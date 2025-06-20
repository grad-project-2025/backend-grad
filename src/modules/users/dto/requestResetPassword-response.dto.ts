import { ApiProperty } from '@nestjs/swagger';

export class RequestResetPasswordData {
  @ApiProperty({ example: 'Password reset email sent' })
  message: string;
}

export class RequestResetPasswordResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: RequestResetPasswordData })
  data: RequestResetPasswordData;
}
