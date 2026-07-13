import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../shared/stripe.service';
import { PricingService } from '../shared/pricing.service';

function toSafeMethod(pm: Stripe.PaymentMethod, defaultId: string | null) {
  return {
    id: pm.id,
    brand: pm.card?.brand ?? 'card',
    last4: pm.card?.last4 ?? '----',
    expMonth: pm.card?.exp_month ?? null,
    expYear: pm.card?.exp_year ?? null,
    isDefault: pm.id === defaultId,
  };
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly pricing: PricingService,
  ) {}

  private get stripe() {
    return this.stripeService.client;
  }

  private async ensureStripeCustomer(userId: number): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, email: true, fullName: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.fullName ?? undefined,
      metadata: { userId: String(userId) },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  private async ownsMethod(userId: number, methodId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) return null;
    const pm = await this.stripe.paymentMethods.retrieve(methodId);
    if (pm.customer !== user.stripeCustomerId) return null;
    return user.stripeCustomerId;
  }

  async createIntent(
    userId: number,
    body: {
      restaurantId: string;
      feastWindowId?: string | null;
      deliveryType?: string;
      items: unknown[];
    },
  ) {
    const normalized = this.pricing.normalizeRequestedItems(body.items);
    if (!normalized.ok) throw new BadRequestException(normalized.error);

    const result = await this.pricing.priceOrder({
      restaurantId: body.restaurantId,
      deliveryType: (body.deliveryType ?? 'delivery') as 'delivery' | 'pickup',
      feastWindowId: body.feastWindowId ?? null,
      items: normalized.items,
    });
    if (!result.ok) throw new BadRequestException(result.error);

    const customerId = await this.ensureStripeCustomer(userId);
    const intent = await this.stripe.paymentIntents.create({
      amount: result.priced.totalCents,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { userId: String(userId), restaurantId: body.restaurantId },
    });

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountCents: result.priced.totalCents,
      breakdown: {
        subtotalCents: result.priced.subtotalCents,
        deliveryFeeCents: result.priced.deliveryFeeCents,
        serviceFeeCents: result.priced.serviceFeeCents,
        discountCents: result.priced.discountCents,
        totalCents: result.priced.totalCents,
      },
    };
  }

  async confirmPayment(
    userId: number,
    body: { paymentIntentId: string; paymentMethod: string; savePaymentMethod?: boolean },
  ) {
    const intent = await this.stripe.paymentIntents.retrieve(body.paymentIntentId);
    if (intent.metadata?.['userId'] !== String(userId))
      throw new ForbiddenException();

    try {
      const confirmed = await this.stripe.paymentIntents.confirm(body.paymentIntentId, {
        payment_method: body.paymentMethod,
        ...(body.savePaymentMethod ? { setup_future_usage: 'off_session' } : {}),
      });
      return { status: confirmed.status };
    } catch (err) {
      if (err instanceof Stripe.errors.StripeCardError) {
        throw new HttpException(
          { error: err.message || 'Your card was declined.', code: err.code ?? 'card_declined', declined: true },
          402,
        );
      }
      throw err;
    }
  }

  async listMethods(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) return [];

    const customer = await this.stripe.customers.retrieve(user.stripeCustomerId);
    const defaultId =
      customer && !customer.deleted
        ? ((customer.invoice_settings?.default_payment_method as string | null) ?? null)
        : null;

    const methods = await this.stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });
    return methods.data.map((pm) => toSafeMethod(pm, defaultId));
  }

  async attachMethod(userId: number, paymentMethod: string) {
    const customerId = await this.ensureStripeCustomer(userId);
    const attached = await this.stripe.paymentMethods.attach(paymentMethod, {
      customer: customerId,
    });

    const existing = await this.stripe.paymentMethods.list({ customer: customerId, type: 'card' });
    let defaultId: string | null = null;
    if (existing.data.length === 1) {
      await this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: attached.id },
      });
      defaultId = attached.id;
    } else {
      const customer = await this.stripe.customers.retrieve(customerId);
      defaultId =
        customer && !customer.deleted
          ? ((customer.invoice_settings?.default_payment_method as string | null) ?? null)
          : null;
    }
    return toSafeMethod(attached, defaultId);
  }

  async setDefaultMethod(userId: number, methodId: string) {
    const customerId = await this.ownsMethod(userId, methodId);
    if (!customerId) throw new NotFoundException('Payment method not found');
    await this.stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: methodId },
    });
    return { id: methodId, isDefault: true };
  }

  async deleteMethod(userId: number, methodId: string) {
    const customerId = await this.ownsMethod(userId, methodId);
    if (!customerId) throw new NotFoundException('Payment method not found');
    await this.stripe.paymentMethods.detach(methodId);
    return { id: methodId, deleted: true };
  }
}
