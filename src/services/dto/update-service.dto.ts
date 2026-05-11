import { IsOptional, IsNumber, IsString, IsBoolean } from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  estimatedTime?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
