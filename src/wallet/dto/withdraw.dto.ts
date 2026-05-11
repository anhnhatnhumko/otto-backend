import { IsNumber, IsString, Min } from 'class-validator';

export class WithdrawDto {
  @IsNumber()
  @Min(50000)
  amount: number;

  @IsString()
  bankName: string;

  @IsString()
  accountNumber: string;
}