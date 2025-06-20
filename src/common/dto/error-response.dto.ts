import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    example: false,
    description: 'Indicates if the request was successful',
  })
  success: boolean;

  @ApiProperty({
    example: 'Bad Request',
    description: 'Error type or title',
    required: false,
  })
  error?: string;

  @ApiProperty({
    example: 'Validation failed',
    description: 'A human-readable error message',
  })
  message: string;

  @ApiProperty({
    example: 400,
    description: 'HTTP status code',
  })
  statusCode: number;

  @ApiProperty({
    example: '2025-02-27T09:05:47.193Z',
    description: 'Timestamp of the error',
    required: false,
  })
  timestamp?: string;

  @ApiProperty({
    example: '/users/register',
    description: 'Request path',
    required: false,
  })
  path?: string;

  @ApiProperty({
    example: { email: 'Invalid email format' },
    description: 'Validation errors (when applicable)',
    required: false,
  })
  errors?: Record<string, string>;
}
