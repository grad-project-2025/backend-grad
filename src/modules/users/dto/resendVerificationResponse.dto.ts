import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationData {
  @ApiProperty({ example: 'Verification email sent successfully' })
  message: string;
}

export class ResendVerificationResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: ResendVerificationData })
  data: ResendVerificationData;
}
