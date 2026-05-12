import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';


function isLocalUrl(value: string) {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(value);
}

function splitUrlCandidates(value: string) {
  return value
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}










import { resolvePublicUrl } from '../utils/public-url.util';

@Injectable()
export class StripeService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia',
  });

  // async createCheckoutSession({
  //   amount,
  //   orderId,
  // }: {
  //   amount: number;
  //   orderId: string;
  // }) {
  //   console.log('🔥 CREATE SESSION ORDER ID:', orderId);
  //   const session = await this.stripe.checkout.sessions.create({
  //     payment_method_types: ['card'],
  //     mode: 'payment',

  //     line_items: [
  //       {
  //         price_data: {
  //           currency: 'vnd',
  //           product_data: {
  //             name: `Order ${orderId}`,
  //           },
  //           unit_amount: amount, // VND
  //         },
  //         quantity: 1,
  //       },
  //     ],

  //     success_url: `${process.env.FRONTEND_URL}/payment/success?orderId=${orderId}`,
  //     cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,

  //     metadata: {
  //       orderId,
  //     },
  //   });

  //   return session.url;
  // }

  async createCheckoutSession({
    amount,
    metadata,
    name,
  }: {
    amount: number;
    metadata: Record<string, string>;
    name: string;
  }) {
    console.log("🔥 ===== STRIPE SERVICE HIT =====");
    console.log("🔥 RECEIVED AMOUNT:", amount);
    console.log("🔥 RECEIVED NAME:", name);
    console.log("🔥 RECEIVED METADATA:", metadata);

    const isOrder = metadata?.type === 'ORDER';
    console.log("🔥 IS ORDER:", isOrder);
    console.log("🔥 metadata.orderId:", metadata?.orderId);

    const frontendUrl = resolvePublicUrl(
      process.env.FRONTEND_URL,
      process.env.BACKEND_URL,
    );

    if (!frontendUrl) {
      throw new Error('FRONTEND_URL is not configured');
    }

    const orderId = metadata?.orderId;
    const successUrl = `${frontendUrl}/payment/success?orderId=${encodeURIComponent(orderId)}&source=stripe&session_id={CHECKOUT_SESSION_ID}`;
    console.log("🔥 SUCCESS URL BUILT:", successUrl);

    console.log("🔥 STRIPE AMOUNT:", amount);
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
            unit_amount: amount, // VND
          },
          quantity: 1,
        },
      ],
      
      success_url: successUrl,
      cancel_url: `${frontendUrl}/payment/cancel`,
      
      metadata,
      
    });
    
    console.log("🔥 STRIPE SESSION ID:", session.id);
    console.log("🔥 STRIPE SESSION URL:", session.url);
    console.log("🔥 ===== STRIPE SERVICE END =====");
    return {
      checkoutUrl: session.url
    }
  }

  async retrieveCheckoutSession(sessionId: string) {
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }

  constructEvent(body: Buffer, sig: string) {
    return this.stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  }
}
