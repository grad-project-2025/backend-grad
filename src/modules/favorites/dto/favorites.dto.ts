import { IsNotEmpty, IsString } from 'class-validator';

export class FavoritDto {
  @IsString()
  @IsNotEmpty()
  flightId: string;
}
