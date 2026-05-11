import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import {
    Transaction,
    TransactionSchema,
} from './schemas/transaction.schema';
import { WalletRepository } from './wallet.repository';
import { TransactionRepository } from './transaction.repository';
import { StripeModule } from 'src/payments/stripe.module';
import { Order, OrderSchema } from 'src/orders/order.schema';
import { BankAccount, BankAccountSchema } from './schemas/bank-account.schema';
import { FakeBank, FakeBankSchema } from './schemas/fake-bank.schema';
import { BankAccountService } from './bank-account.service';
import { BankAccountController } from './bank-account.controller';
// import { PaymentOrchestratorModule } from 'src/payments/payment-orchestrator.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Wallet.name, schema: WalletSchema },
            { name: Transaction.name, schema: TransactionSchema },
            { name: BankAccount.name, schema: BankAccountSchema },
            { name: FakeBank.name, schema: FakeBankSchema },
        ]),
        MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
        StripeModule,
        // PaymentOrchestratorModule,
    ],
    controllers: [WalletController, BankAccountController],
    providers: [
        WalletService,
        WalletRepository,
        TransactionRepository,
        BankAccountService,
    ],
    exports: [
        WalletService,
        BankAccountService,
    ],
})
export class WalletModule { }