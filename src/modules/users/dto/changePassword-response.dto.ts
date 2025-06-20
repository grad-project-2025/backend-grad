import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    type: 'object',
    properties: {
      message: { type: 'string', example: 'Password changed successfully' },
    },
  })
  data: {
    message: string;
  };
}
