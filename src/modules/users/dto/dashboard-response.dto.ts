import { ApiProperty } from '@nestjs/swagger';
export class DashboardResponseDto {
  @ApiProperty({ example: 'Admin-only content' })
  message: string;
}
