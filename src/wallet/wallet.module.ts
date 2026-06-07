import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailModule } from 'src/mail/mail.module';
import { StripeModule } from 'src/payments/stripe.module';
import { User, UserSchema } from 'src/users/user.schema';
import { BankAccountController } from './bank-account.controller';
import { BankAccountService } from './bank-account.service';
import { TransactionRepository } from './transaction.repository';
import { WalletController } from './wallet.controller';
import { WalletRepository } from './wallet.repository';
import { WalletService } from './wallet.service';
import { BankAccount, BankAccountSchema } from './schemas/bank-account.schema';
import { FakeBank, FakeBankSchema } from './schemas/fake-bank.schema';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { Wallet, WalletSchema } from './schemas/wallet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: BankAccount.name, schema: BankAccountSchema },
      { name: FakeBank.name, schema: FakeBankSchema },
      { name: User.name, schema: UserSchema },
    ]),
    StripeModule,
    MailModule,
  ],
  controllers: [WalletController, BankAccountController],
  providers: [
    WalletService,
    WalletRepository,
    TransactionRepository,
    BankAccountService,
  ],
  exports: [WalletService, BankAccountService],
})
export class WalletModule {}
