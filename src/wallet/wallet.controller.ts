import {
    Controller,
    Get,
    Post,
    Body,
    Req,
    Param,
    UseGuards,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { DepositDto } from './dto/deposit.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt.guard';
import { WithdrawDto } from './dto/withdraw.dto';
import { PaymentOrchestratorService } from 'src/payments/payment-orchestrator.service';
import { OrdersService } from 'src/orders/orders.service';


@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
    constructor(
        private walletService: WalletService,
        // private paymentOrchestrator: PaymentOrchestratorService,
    ) { }

    @Get()
    getWallet(@Req() req) {
        console.log("🔥 COOKIE:", req.cookies);
        console.log("🔥 USER:", req.user);
        return this.walletService.getWallet(req.user.userId);
    }

    @Get('transactions')
    getTransactions(@Req() req) {
        return this.walletService.getTransactions(req.user.userId);
    }

    @Post('deposit')
    deposit(@Req() req, @Body() dto: DepositDto) {
        console.log("🔥 CONTROLLER HIT DEPOSIT");
        console.log("🔥 BODY:", dto);
        console.log("🔥 USER:", req.user);
        return this.walletService.deposit(req.user.userId, dto.amount);
    }

    // MOCK webhook/test
    // @Post('success/:id')
    // simulateSuccess(@Param('id') id: string) {
    //     return this.walletService.handleStripeSuccess(id);
    // }

    @Post('success/deposit/:id')
    simulateDeposit(@Param('id') id: string) {
        console.log("🔥 SIMULATE DEPOSIT:", id);
        return this.walletService.handleStripeSuccess(id);
    }

    @Post('success/order')
    simulateOrder(@Body() body: {
        userId: string;
        orderId: string;
        amount: number;
    }) {
        console.log("🔥 SIMULATE ORDER:", body);

        return this.walletService.createEscrowTransaction({
            userId: body.userId,
            orderId: body.orderId,
            amount: body.amount,
        });
    }

    @Post('withdraw')
    withdraw(@Req() req, @Body() dto: WithdrawDto) {
        console.log("🔥 CONTROLLER HIT WITHDRAW");
        console.log("🔥 BODY:", dto);
        console.log("🔥 USER:", req.user);
        return this.walletService.withdraw(req.user.userId, dto);
    }
}