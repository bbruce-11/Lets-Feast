"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const stripe_1 = require("stripe");
const prisma_service_1 = require("../prisma/prisma.service");
const stripe_service_1 = require("../shared/stripe.service");
const pricing_service_1 = require("../shared/pricing.service");
function toSafeMethod(pm, defaultId) {
    return {
        id: pm.id,
        brand: pm.card?.brand ?? 'card',
        last4: pm.card?.last4 ?? '----',
        expMonth: pm.card?.exp_month ?? null,
        expYear: pm.card?.exp_year ?? null,
        isDefault: pm.id === defaultId,
    };
}
let PaymentsService = class PaymentsService {
    constructor(prisma, stripeService, pricing) {
        this.prisma = prisma;
        this.stripeService = stripeService;
        this.pricing = pricing;
    }
    get stripe() {
        return this.stripeService.client;
    }
    async ensureStripeCustomer(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { stripeCustomerId: true, email: true, fullName: true },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (user.stripeCustomerId)
            return user.stripeCustomerId;
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
    async ownsMethod(userId, methodId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { stripeCustomerId: true },
        });
        if (!user?.stripeCustomerId)
            return null;
        const pm = await this.stripe.paymentMethods.retrieve(methodId);
        if (pm.customer !== user.stripeCustomerId)
            return null;
        return user.stripeCustomerId;
    }
    async createIntent(userId, body) {
        const normalized = this.pricing.normalizeRequestedItems(body.items);
        if (!normalized.ok)
            throw new common_1.BadRequestException(normalized.error);
        const result = await this.pricing.priceOrder({
            restaurantId: body.restaurantId,
            deliveryType: (body.deliveryType ?? 'delivery'),
            feastWindowId: body.feastWindowId ?? null,
            items: normalized.items,
        });
        if (!result.ok)
            throw new common_1.BadRequestException(result.error);
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
    async confirmPayment(userId, body) {
        const intent = await this.stripe.paymentIntents.retrieve(body.paymentIntentId);
        if (intent.metadata?.['userId'] !== String(userId))
            throw new common_1.ForbiddenException();
        try {
            const confirmed = await this.stripe.paymentIntents.confirm(body.paymentIntentId, {
                payment_method: body.paymentMethod,
                ...(body.savePaymentMethod ? { setup_future_usage: 'off_session' } : {}),
            });
            return { status: confirmed.status };
        }
        catch (err) {
            if (err instanceof stripe_1.default.errors.StripeCardError) {
                throw new common_1.HttpException({ error: err.message || 'Your card was declined.', code: err.code ?? 'card_declined', declined: true }, 402);
            }
            throw err;
        }
    }
    async listMethods(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { stripeCustomerId: true },
        });
        if (!user?.stripeCustomerId)
            return [];
        const customer = await this.stripe.customers.retrieve(user.stripeCustomerId);
        const defaultId = customer && !customer.deleted
            ? (customer.invoice_settings?.default_payment_method ?? null)
            : null;
        const methods = await this.stripe.paymentMethods.list({
            customer: user.stripeCustomerId,
            type: 'card',
        });
        return methods.data.map((pm) => toSafeMethod(pm, defaultId));
    }
    async attachMethod(userId, paymentMethod) {
        const customerId = await this.ensureStripeCustomer(userId);
        const attached = await this.stripe.paymentMethods.attach(paymentMethod, {
            customer: customerId,
        });
        const existing = await this.stripe.paymentMethods.list({ customer: customerId, type: 'card' });
        let defaultId = null;
        if (existing.data.length === 1) {
            await this.stripe.customers.update(customerId, {
                invoice_settings: { default_payment_method: attached.id },
            });
            defaultId = attached.id;
        }
        else {
            const customer = await this.stripe.customers.retrieve(customerId);
            defaultId =
                customer && !customer.deleted
                    ? (customer.invoice_settings?.default_payment_method ?? null)
                    : null;
        }
        return toSafeMethod(attached, defaultId);
    }
    async setDefaultMethod(userId, methodId) {
        const customerId = await this.ownsMethod(userId, methodId);
        if (!customerId)
            throw new common_1.NotFoundException('Payment method not found');
        await this.stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: methodId },
        });
        return { id: methodId, isDefault: true };
    }
    async deleteMethod(userId, methodId) {
        const customerId = await this.ownsMethod(userId, methodId);
        if (!customerId)
            throw new common_1.NotFoundException('Payment method not found');
        await this.stripe.paymentMethods.detach(methodId);
        return { id: methodId, deleted: true };
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stripe_service_1.StripeService,
        pricing_service_1.PricingService])
], PaymentsService);
