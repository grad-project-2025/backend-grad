import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './register-response.dto';

export class UpdateRolesData {
  @ApiProperty({ example: 'User roles updated successfully' })
  message: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class UpdateRolesResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: UpdateRolesData })
  data: UpdateRolesData;
}
