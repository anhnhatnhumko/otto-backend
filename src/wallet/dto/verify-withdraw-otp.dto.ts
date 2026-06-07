import { IsString, Length } from 'class-validator';

export class VerifyWithdrawOtpDto {
  @IsString()
  transactionId: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}
