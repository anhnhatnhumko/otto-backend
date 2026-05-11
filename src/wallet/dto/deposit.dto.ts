import { IsNumber, Min, IsString } from 'class-validator';

export class DepositDto {
  @IsNumber()
  @Min(1000)
  amount: number;

  @IsString()
  method: string; // stripe | mock
}