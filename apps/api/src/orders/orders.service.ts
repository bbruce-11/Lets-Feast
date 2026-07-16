import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WsService } from '../ws/ws.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../shared/pricing.service';
import { StripeService } from '../shared/stripe.service';
import { CommissionService } from '../shared/commission.service';
import {
  deriveDriverProgress,
  deriveEtaMinutes,
  deriveOrderStatus,
  etaForStatus,
  isTerminal,
  isValidStatus,
  nextStatus,
  progressForStatus,
} from '../common/order-status.util';

// Plain object type — compatible with both OrderCreateInput and OrderUpdateInput.
type TimestampPatch = {
  confirmedAt?: Date;
  preparingAt?: Date;
  driverAssignedAt?: Date;
  onTheWayAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
};

function tsPatch(status: string): TimestampPatch {
  const now = new Date();
  switch (status) {
    case 'confirmed':       return { confirmedAt: now };
    case 'preparing':       return { preparingAt: now };
    case 'driver_assigned': return { driverAssignedAt: now };
    case 'on_the_way':      return { onTheWayAt: now };
    case 'delivered':       return { deliveredAt: now };
    case 'cancelled':       return { cancelledAt: now };
    default:                return {};
  }
}

type TrackingBase = { status: string; statusManual: boolean; createdAt: Date };

function withTracking<T extends TrackingBase>(order: T): T & { driverProgress: number; etaMinutes: number } {
  const delivered = order.status === 'delivered';
  if (order.statusManual) {
    return {
      ...order,
      driverProgress: delivered ? 1 : progressForStatus(order.status),
      etaMinutes: delivered ? 0 : etaForStatus(order.status),
    };
  }
  return {
    ...order,
    driverProgress: delivered ? 1 : deriveDriverProgress(order.createdAt),
    etaMinutes: delivered ? 0 : deriveEtaMinutes(order.createdAt),
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: WsService,
    private readonly notifications: NotificationsService,
    private readonly pricing: PricingService,
    private readonly stripeService: StripeService,
    private readonly commission: CommissionService,
  ) {}

  private async syncStatus<
    T extends { id: number; status: string; statusManual: boolean; createdAt: Date },
  >(order: T): Promise<T> {
    if (order.statusManual || isTerminal(order.status)) return order;
    const derived = deriveOrderStatus(order.createdAt);
    if (derived === order.status) return order;
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: derived, updatedAt: new Date(), ...tsPatch(derived) } as Prisma.OrderUpdateInput,
    });
    return { ...order, status: derived };
  }

  private async applyManualStatus(orderId: number, status: string) {
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        statusManual: true,
        updatedAt: new Date(),
        ...tsPatch(status),
      } as Prisma.OrderUpdateInput,
    });
    this.notifications.notifyManualStatus(orderId, status);
    this.ws.broadcastOrderUpdate(updated);
    return updated;
  }

  private async recomputeRestaurantRating(restaurantId: string): Promise<void> {
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

  async placeOrder(
    userId: number,
    body: {
      restaurantId: string;
      feastWindowId?: string | null;
      deliveryType?: string;
      deliveryAddress?: string | null;
      deliveryLat?: number | null;
      deliveryLng?: number | null;
      items: unknown[];
      paymentIntentId: string;
      tipCents?: number;
    },
  ) {
    const { restaurantId, feastWindowId, deliveryAddress, deliveryLat, deliveryLng, paymentIntentId } = body;
    if (!restaurantId || !Array.isArray(body.items) || body.items.length === 0)
      throw new BadRequestException('restaurantId and a non-empty items array are required');
    if (!paymentIntentId)
      throw new BadRequestException('A confirmed payment is required to place an order');

    const normalized = this.pricing.normalizeRequestedItems(body.items);
    if (!normalized.ok) throw new BadRequestException(normalized.error);

    const effectiveDeliveryType = (body.deliveryType ?? 'delivery') as 'delivery' | 'pickup';

    const priceResult = await this.pricing.priceOrder({
      restaurantId,
      deliveryType: effectiveDeliveryType,
      feastWindowId: feastWindowId ?? null,
      tipCents: body.tipCents ?? 0,
      items: normalized.items,
    });
    if (!priceResult.ok) throw new BadRequestException(priceResult.error);

    const { lineItems, subtotalCents, tipCents, totalCents } = priceResult.priced;
    const subtotal = (subtotalCents / 100).toFixed(2);
    const total = (totalCents / 100).toFixed(2);

    // Computed before touching Stripe: a misconfigured restaurant (no active
    // commission rule) should fail before we verify/charge payment, not after.
    const commissionBreakdown = await this.commission.computeFees({
      restaurantId,
      subtotalCents,
      tipCents,
      deliveryType: effectiveDeliveryType,
    });

    let paymentIntent;
    try {
      paymentIntent = await this.stripeService.client.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.payment_method_details'],
      });
    } catch {
      throw new BadRequestException('Payment could not be verified');
    }

    if (paymentIntent.metadata?.['userId'] !== String(userId))
      throw new ForbiddenException('This payment does not belong to you');
    if (paymentIntent.status !== 'succeeded')
      throw new BadRequestException('Payment has not been completed');
    if (paymentIntent.amount !== totalCents || paymentIntent.currency !== 'usd')
      throw new BadRequestException('Payment amount does not match the order total');

    const charge =
      typeof paymentIntent.latest_charge === 'object' && paymentIntent.latest_charge != null
        ? (paymentIntent.latest_charge as { payment_method_details?: { card?: { brand?: string; last4?: string } } })
        : null;
    const cardDetails = charge?.payment_method_details?.card ?? null;
    const cardBrand = cardDetails?.brand ?? null;
    const cardLast4 = cardDetails?.last4 ?? null;

    const isDelivery = effectiveDeliveryType === 'delivery';
    const trimmedAddress =
      isDelivery && typeof deliveryAddress === 'string' && deliveryAddress.trim()
        ? deliveryAddress.trim()
        : null;
    const lat =
      isDelivery && typeof deliveryLat === 'number' && Number.isFinite(deliveryLat)
        ? String(deliveryLat)
        : null;
    const lng =
      isDelivery && typeof deliveryLng === 'number' && Number.isFinite(deliveryLng)
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
            items: lineItems as unknown as Prisma.InputJsonValue,
            subtotal,
            total,
            tipCents,
            commissionRuleId: commissionBreakdown.commissionRuleId,
            platformFeeCents: commissionBreakdown.platformFeeCents,
            restaurantPayoutCents: commissionBreakdown.restaurantPayoutCents,
            courierFeeCents: commissionBreakdown.courierFeeCents,
            paymentIntentId,
            paymentStatus: paymentIntent.status,
            cardBrand,
            cardLast4,
            status: 'confirmed',
            ...tsPatch('confirmed'),
          } as Prisma.OrderUncheckedCreateInput,
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
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This payment has already been used for an order');
      }
      try {
        await this.stripeService.client.refunds.create({ payment_intent: paymentIntentId });
      } catch { /* log only */ }
      throw new InternalServerErrorException('Failed to place order');
    }

    this.notifications.scheduleOrderById(order.id);
    return order;
  }

  // ---- My Orders ----

  async getMyOrders(userId: number) {
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

  async getOrder(orderId: number, userId: number) {
    const row = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException('Order not found');
    if (row.userId !== userId) throw new ForbiddenException();

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

  async updateStatus(orderId: number, status: string) {
    if (!isValidStatus(status)) throw new BadRequestException('Invalid status');
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const updated = await this.applyManualStatus(orderId, status);
    return withTracking(updated);
  }

  async advanceOrder(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const next = nextStatus(order.status);
    if (!next) throw new ConflictException('Order is already at the final status');
    const updated = await this.applyManualStatus(orderId, next);
    return withTracking(updated);
  }

  // ---- Rating ----

  async rateOrder(orderId: number, userId: number, rating: number, comment?: string | null) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      throw new BadRequestException('rating must be an integer between 1 and 5');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();

    const synced = await this.syncStatus(order);
    if (synced.status !== 'delivered')
      throw new ConflictException('You can only rate an order after it has been delivered');

    const isEdit = order.rating != null;
    const trimmedComment =
      typeof comment === 'string' && comment.trim() ? comment.trim() : null;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { rating, ratingComment: trimmedComment, ratedAt: new Date(), updatedAt: new Date() },
    });

    await this.recomputeRestaurantRating(order.restaurantId);
    return { order: updated, isEdit };
  }
}
