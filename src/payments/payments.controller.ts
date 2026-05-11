import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Res,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { PaymentService } from './payments.service';
import { Public } from 'src/common/decorators/public.decorator';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentController {
  constructor(private paymentService: PaymentService) { }

  // ==========================
  // CREATE PAYMENT
  // ==========================
  @Post(':id/create')
  @Roles(Role.CUSTOMER)
  createPayment(@Param('id') id: string, @Req() req, @Body() body) {
    return this.paymentService.createPayment(
      id,
      req.user.userId,
      body.method,
    );
  }


  @Post('stripe/webhook')
  @Public()
  handleStripeWebhook(@Req() req: RawBodyRequest<Request>) {
    console.log('WEBHOOK CONTROLLER HIT');
    const sigHeader = req.headers['stripe-signature'];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

    if (!sig) {
      return { received: false };
    }

    return this.paymentService.handleStripeWebhook(
      req.rawBody as Buffer,
      sig,
    );
  }

  @Get('stripe/success')
  @Public()
  async handleStripeSuccessRedirect(
    @Query('session_id') sessionId: string,
    @Res() res: Response,
  ) {
    const { redirectUrl } = await this.paymentService.confirmStripeSession(sessionId);
    return res.redirect(redirectUrl);
  }
}
