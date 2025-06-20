import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;
  @ApiProperty({
    example: 'Validation failed',
    description: 'A human-readable error message',
  })
  message: string;

  @ApiProperty({
    example: 'Bad Request',
    description: 'HTTP error type',
  })
  error: string;

  @ApiProperty({
    example: 400,
    description: 'HTTP status code',
  })
  statusCode: number;

  @ApiProperty({
    example: '2025-02-27T09:05:47.193Z',
    description: 'Timestamp of the error',
  })
  timestamp: string;

  @ApiProperty({
    example: '/users/register',
    description: 'Request path',
  })
  path: string;

  @ApiProperty({
    required: false,
    example: { email: 'Invalid email format' },
    description: 'Validation errors (when applicable)',
  })
  errors?: Record<string, string>;
}
