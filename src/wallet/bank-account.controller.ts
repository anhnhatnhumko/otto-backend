import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt.guard';
import { BankAccountService } from './bank-account.service';

@UseGuards(JwtAuthGuard)
@Controller('bank-accounts')
export class BankAccountController {
  constructor(private service: BankAccountService) {}

  @Get()
  getMyBanks(@Req() req) {
    return this.service.getByUser(req.user.userId);
  }

  @Post()
  create(@Req() req, @Body() body: any) {
    return this.service.create(req.user.userId, body);
  }
}