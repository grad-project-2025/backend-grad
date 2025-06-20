import {
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  IsEnum,
  IsBoolean,
} from 'class-validator';
enum CabinClass {
  Economy = 'Economy',
  Business = 'Business',
  First = 'First',
}
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredAirlines?: string[];

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  loyaltyProgram?: {
    status: string;
    points: number;
  };

  @IsOptional()
  @IsArray()
  bookingHistory?: Array<{
    airline: string;
    date: string;
    cabinClass: string;
  }>;

  @IsOptional()
  @IsEnum(['economy', 'premium', 'business', 'first'])
  preferredCabinClass?: string;

  @IsOptional()
  @IsBoolean()
  useRecommendationSystem?: boolean;
}
