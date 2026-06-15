import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class DepositDto {
  @IsNumber()
  @Min(1000)
  amount: number;

  @IsString()
  method: string; // stripe | mock

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9+.-]*:\/\//i)
  successUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9+.-]*:\/\//i)
  cancelUrl?: string;
}
