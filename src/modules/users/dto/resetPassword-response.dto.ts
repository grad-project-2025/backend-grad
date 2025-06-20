import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordData {
  @ApiProperty({ example: 'Password reset successfully' })
  message: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: ResetPasswordData })
  data: ResetPasswordData;
}
