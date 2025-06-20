import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './register-response.dto';

export class ProfileData {
  @ApiProperty({ example: 'User profile retrieved successfully' })
  message: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class ProfileResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: ProfileData })
  data: ProfileData;
}
