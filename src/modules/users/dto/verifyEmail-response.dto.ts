import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailData {
  @ApiProperty({ example: 'Email verified successfully' })
  message: string;
}

export class VerifyEmailResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: VerifyEmailData })
  data: VerifyEmailData;
}
