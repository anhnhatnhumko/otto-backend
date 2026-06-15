import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt.guard';
import { DepositDto } from './dto/deposit.dto';
import { VerifyWithdrawOtpDto } from './dto/verify-withdraw-otp.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { WalletService } from './wallet.service';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get()
  getWallet(@Req() req) {
    console.log('ðŸ”¥ COOKIE:', req.cookies);
    console.log('ðŸ”¥ USER:', req.user);
    return this.walletService.getWallet(req.user.userId);
  }

  @Get('transactions')
  getTransactions(@Req() req) {
    return this.walletService.getTransactions(req.user.userId);
  }

  @Post('deposit')
  deposit(@Req() req, @Body() dto: DepositDto) {
    console.log('ðŸ”¥ CONTROLLER HIT DEPOSIT');
    console.log('ðŸ”¥ BODY:', dto);
    console.log('ðŸ”¥ USER:', req.user);
    return this.walletService.deposit(req.user.userId, dto.amount, {
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });
  }

  // MOCK webhook/test
  // @Post('success/:id')
  // simulateSuccess(@Param('id') id: string) {
  //   return this.walletService.handleStripeSuccess(id);
  // }

  @Post('success/deposit/:id')
  simulateDeposit(@Param('id') id: string) {
    console.log('ðŸ”¥ SIMULATE DEPOSIT:', id);
    return this.walletService.handleStripeSuccess(id);
  }

  @Post('success/order')
  simulateOrder(
    @Body()
    body: {
      userId: string;
      orderId: string;
      amount: number;
    },
  ) {
    console.log('ðŸ”¥ SIMULATE ORDER:', body);

    return this.walletService.createEscrowTransaction({
      userId: body.userId,
      orderId: body.orderId,
      amount: body.amount,
    });
  }

  @Post('withdraw')
  withdraw(@Req() req, @Body() dto: WithdrawDto) {
    console.log('ðŸ”¥ CONTROLLER HIT WITHDRAW');
    console.log('ðŸ”¥ BODY:', dto);
    console.log('ðŸ”¥ USER:', req.user);
    return this.walletService.withdraw(req.user.userId, dto);
  }

  @Post('withdraw/request')
  requestWithdrawOtp(@Req() req, @Body() dto: WithdrawDto) {
    return this.walletService.requestWithdrawOtp(req.user.userId, dto);
  }

  @Post('withdraw/verify')
  verifyWithdrawOtp(@Req() req, @Body() dto: VerifyWithdrawOtpDto) {
    return this.walletService.verifyWithdrawOtp(
      req.user.userId,
      dto.transactionId,
      dto.otp,
    );
  }
}
