import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { resolvePublicUrl } from '../utils/public-url.util';

type CreateCheckoutSessionParams = {
  amount: number;
  metadata: Record<string, string>;
  name: string;
};

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error('Missing STRIPE_SECRET_KEY');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-03-25.dahlia',
    });
  }

  async createCheckoutSession({
    amount,
    metadata,
    name,
  }: CreateCheckoutSessionParams) {
    const frontendUrl = resolvePublicUrl(
      process.env.FRONTEND_URL,
      process.env.BACKEND_URL,
    );

    if (!frontendUrl) {
      throw new Error('FRONTEND_URL is not configured');
    }

    const orderId = metadata?.orderId;
    const successUrl = `${frontendUrl}/payment/success?orderId=${encodeURIComponent(orderId)}&source=stripe&session_id={CHECKOUT_SESSION_ID}`;

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'vnd',
            product_data: {
              name,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: `${frontendUrl}/payment/cancel`,
      metadata,
    });

    return {
      checkoutUrl: session.url,
    };
  }

  async retrieveCheckoutSession(sessionId: string) {
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }

  constructEvent(body: Buffer, sig: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET');
    }

    return this.stripe.webhooks.constructEvent(body, sig, webhookSecret);
  }
}
