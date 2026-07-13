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
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const ws_service_1 = require("../ws/ws.service");
const notifications_service_1 = require("../notifications/notifications.service");
const pricing_service_1 = require("../shared/pricing.service");
const stripe_service_1 = require("../shared/stripe.service");
const order_status_util_1 = require("../common/order-status.util");
function tsPatch(status) {
    const now = new Date();
    switch (status) {
        case 'confirmed': return { confirmedAt: now };
        case 'preparing': return { preparingAt: now };
        case 'driver_assigned': return { driverAssignedAt: now };
        case 'on_the_way': return { onTheWayAt: now };
        case 'delivered': return { deliveredAt: now };
        case 'cancelled': return { cancelledAt: now };
        default: return {};
    }
}
function withTracking(order) {
    const delivered = order.status === 'delivered';
    if (order.statusManual) {
        return {
            ...order,
            driverProgress: delivered ? 1 : (0, order_status_util_1.progressForStatus)(order.status),
            etaMinutes: delivered ? 0 : (0, order_status_util_1.etaForStatus)(order.status),
        };
    }
    return {
        ...order,
        driverProgress: delivered ? 1 : (0, order_status_util_1.deriveDriverProgress)(order.createdAt),
        etaMinutes: delivered ? 0 : (0, order_status_util_1.deriveEtaMinutes)(order.createdAt),
    };
}
let OrdersService = class OrdersService {
    constructor(prisma, ws, notifications, pricing, stripeService) {
        this.prisma = prisma;
        this.ws = ws;
        this.notifications = notifications;
        this.pricing = pricing;
        this.stripeService = stripeService;
    }
    async syncStatus(order) {
        if (order.statusManual || (0, order_status_util_1.isTerminal)(order.status))
            return order;
        const derived = (0, order_status_util_1.deriveOrderStatus)(order.createdAt);
        if (derived === order.status)
            return order;
        await this.prisma.order.update({
            where: { id: order.id },
            data: { status: derived, updatedAt: new Date(), ...tsPatch(derived) },
        });
        return { ...order, status: derived };
    }
    async applyManualStatus(orderId, status) {
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status,
                statusManual: true,
                updatedAt: new Date(),
                ...tsPatch(status),
            },
        });
        this.notifications.notifyManualStatus(orderId, status);
        this.ws.broadcastOrderUpdate(updated);
        return updated;
    }
    async recomputeRestaurantRating(restaurantId) {
        const agg = await this.prisma.order.aggregate({
            where: { restaurantId, rating: { not: null } },
            _avg: { rating: true },
            _count: { rating: true },
        });
        const n = agg._count.rating;
        const avg = agg._avg.rating;
        const rating = n > 0 && avg != null ? Number(avg).toFixed(1) : '0';
        await this.prisma.restaurant.update({
            where: { id: restaurantId },
            data: { rating, numRatings: n },
        });
    }
    // ---- Place Order ----
    async placeOrder(userId, body) {
        const { restaurantId, feastWindowId, deliveryAddress, deliveryLat, deliveryLng, paymentIntentId } = body;
        if (!restaurantId || !Array.isArray(body.items) || body.items.length === 0)
            throw new common_1.BadRequestException('restaurantId and a non-empty items array are required');
        if (!paymentIntentId)
            throw new common_1.BadRequestException('A confirmed payment is required to place an order');
        const normalized = this.pricing.normalizeRequestedItems(body.items);
        if (!normalized.ok)
            throw new common_1.BadRequestException(normalized.error);
        const effectiveDeliveryType = (body.deliveryType ?? 'delivery');
        const priceResult = await this.pricing.priceOrder({
            restaurantId,
            deliveryType: effectiveDeliveryType,
            feastWindowId: feastWindowId ?? null,
            items: normalized.items,
        });
        if (!priceResult.ok)
            throw new common_1.BadRequestException(priceResult.error);
        const { lineItems, subtotalCents, totalCents } = priceResult.priced;
        const subtotal = (subtotalCents / 100).toFixed(2);
        const total = (totalCents / 100).toFixed(2);
        let paymentIntent;
        try {
            paymentIntent = await this.stripeService.client.paymentIntents.retrieve(paymentIntentId, {
                expand: ['latest_charge.payment_method_details'],
            });
        }
        catch {
            throw new common_1.BadRequestException('Payment could not be verified');
        }
        if (paymentIntent.metadata?.['userId'] !== String(userId))
            throw new common_1.ForbiddenException('This payment does not belong to you');
        if (paymentIntent.status !== 'succeeded')
            throw new common_1.BadRequestException('Payment has not been completed');
        if (paymentIntent.amount !== totalCents || paymentIntent.currency !== 'usd')
            throw new common_1.BadRequestException('Payment amount does not match the order total');
        const charge = typeof paymentIntent.latest_charge === 'object' && paymentIntent.latest_charge != null
            ? paymentIntent.latest_charge
            : null;
        const cardDetails = charge?.payment_method_details?.card ?? null;
        const cardBrand = cardDetails?.brand ?? null;
        const cardLast4 = cardDetails?.last4 ?? null;
        const isDelivery = effectiveDeliveryType === 'delivery';
        const trimmedAddress = isDelivery && typeof deliveryAddress === 'string' && deliveryAddress.trim()
            ? deliveryAddress.trim()
            : null;
        const lat = isDelivery && typeof deliveryLat === 'number' && Number.isFinite(deliveryLat)
            ? String(deliveryLat)
            : null;
        const lng = isDelivery && typeof deliveryLng === 'number' && Number.isFinite(deliveryLng)
            ? String(deliveryLng)
            : null;
        let order;
        try {
            order = await this.prisma.$transaction(async (tx) => {
                const created = await tx.order.create({
                    data: {
                        userId,
                        restaurantId,
                        feastWindowId: feastWindowId ?? null,
                        deliveryType: effectiveDeliveryType,
                        deliveryAddress: trimmedAddress,
                        deliveryLat: lat,
                        deliveryLng: lng,
                        items: lineItems,
                        subtotal,
                        total,
                        paymentIntentId,
                        paymentStatus: paymentIntent.status,
                        cardBrand,
                        cardLast4,
                        status: 'confirmed',
                        ...tsPatch('confirmed'),
                    },
                });
                await tx.orderItem.createMany({
                    data: lineItems.map((li) => ({
                        orderId: created.id,
                        menuItemId: li.menuItemId,
                        name: li.name,
                        unitPrice: li.price.toFixed(2),
                        quantity: li.quantity,
                        specialInstructions: li.specialInstructions ?? null,
                    })),
                });
                return created;
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('This payment has already been used for an order');
            }
            try {
                await this.stripeService.client.refunds.create({ payment_intent: paymentIntentId });
            }
            catch { /* log only */ }
            throw new common_1.InternalServerErrorException('Failed to place order');
        }
        this.notifications.scheduleOrderById(order.id);
        return order;
    }
    // ---- My Orders ----
    async getMyOrders(userId) {
        const rows = await this.prisma.order.findMany({
            where: { userId },
            include: { restaurant: { select: { name: true } } },
            orderBy: { createdAt: 'asc' },
        });
        const flat = rows.map((r) => ({
            ...r,
            subtotal: r.subtotal.toString(),
            restaurantName: r.restaurant?.name ?? null,
            restaurant: undefined,
        }));
        const synced = await Promise.all(flat.map((r) => this.syncStatus(r)));
        return synced.map((r) => withTracking(r));
    }
    // ---- Active Orders (staff) ----
    async getActiveOrders() {
        const rows = await this.prisma.order.findMany({
            where: { status: { notIn: ['delivered', 'cancelled'] } },
            include: {
                restaurant: { select: { name: true } },
                user: { select: { fullName: true, phone: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        const flat = rows.map((r) => ({
            ...r,
            subtotal: r.subtotal.toString(),
            restaurantName: r.restaurant?.name ?? null,
            customerName: r.user?.fullName ?? null,
            customerPhone: r.user?.phone ?? null,
            restaurant: undefined,
            user: undefined,
        }));
        const synced = await Promise.all(flat.map((r) => this.syncStatus(r)));
        const active = synced.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
        return active.map((r) => withTracking(r));
    }
    // ---- Get Order ----
    async getOrder(orderId, userId) {
        const row = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { restaurant: { select: { name: true } } },
        });
        if (!row)
            throw new common_1.NotFoundException('Order not found');
        if (row.userId !== userId)
            throw new common_1.ForbiddenException();
        await this.prisma.order.update({
            where: { id: orderId },
            data: { lastPolledAt: new Date() },
        });
        const flat = {
            ...row,
            subtotal: row.subtotal.toString(),
            restaurantName: row.restaurant?.name ?? null,
            restaurant: undefined,
        };
        const synced = await this.syncStatus(flat);
        return withTracking(synced);
    }
    // ---- Status Updates ----
    async updateStatus(orderId, status) {
        if (!(0, order_status_util_1.isValidStatus)(status))
            throw new common_1.BadRequestException('Invalid status');
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const updated = await this.applyManualStatus(orderId, status);
        return withTracking(updated);
    }
    async advanceOrder(orderId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const next = (0, order_status_util_1.nextStatus)(order.status);
        if (!next)
            throw new common_1.ConflictException('Order is already at the final status');
        const updated = await this.applyManualStatus(orderId, next);
        return withTracking(updated);
    }
    // ---- Rating ----
    async rateOrder(orderId, userId, rating, comment) {
        if (!Number.isInteger(rating) || rating < 1 || rating > 5)
            throw new common_1.BadRequestException('rating must be an integer between 1 and 5');
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.userId !== userId)
            throw new common_1.ForbiddenException();
        const synced = await this.syncStatus(order);
        if (synced.status !== 'delivered')
            throw new common_1.ConflictException('You can only rate an order after it has been delivered');
        const isEdit = order.rating != null;
        const trimmedComment = typeof comment === 'string' && comment.trim() ? comment.trim() : null;
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { rating, ratingComment: trimmedComment, ratedAt: new Date(), updatedAt: new Date() },
        });
        await this.recomputeRestaurantRating(order.restaurantId);
        return { order: updated, isEdit };
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ws_service_1.WsService,
        notifications_service_1.NotificationsService,
        pricing_service_1.PricingService,
        stripe_service_1.StripeService])
], OrdersService);
