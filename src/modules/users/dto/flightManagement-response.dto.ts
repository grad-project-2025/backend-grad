import { ApiProperty } from '@nestjs/swagger';
export class FlightManagementResponseDto {
  @ApiProperty({ example: 'Flight management dashboard' })
  message: string;
}
