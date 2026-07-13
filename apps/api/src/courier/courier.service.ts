import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WsService } from '../ws/ws.service';

@Injectable()
export class CourierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: WsService,
  ) {}

  /** Returns orders in driver_assigned or on_the_way that belong to this driver. */
  async getDriverOrders(userId: number) {
    const rows = await this.prisma.order.findMany({
      where: {
        status: { in: ['driver_assigned', 'on_the_way'] },
        driverId: userId,
      },
      include: {
        restaurant: { select: { name: true } },
        user: { select: { fullName: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((r) => ({
      ...r,
      subtotal: r.subtotal.toString(),
      restaurantName: r.restaurant?.name ?? null,
      customerName: r.user?.fullName ?? null,
      customerPhone: r.user?.phone ?? null,
      restaurant: undefined,
      user: undefined,
    }));
  }

  /** Advances a delivery order to on_the_way or delivered. Drivers may only update their own orders. */
  async updateDeliveryStatus(
    orderId: number,
    status: string,
    userId: number,
    userRole: string,
  ) {
    const allowed = ['on_the_way', 'delivered'];
    if (!allowed.includes(status)) {
      throw new ForbiddenException(`Couriers may only set status to: ${allowed.join(', ')}`);
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    // Drivers may only update orders explicitly assigned to them; admins bypass.
    if (userRole !== 'admin' && order.driverId !== userId) {
      throw new ForbiddenException('You are not assigned to this order');
    }

    const prev = order.status;
    if (prev === status) return order;

    const now = new Date();
    const tsPatch: Record<string, Date> = {};
    if (status === 'on_the_way') tsPatch['onTheWayAt'] = now;
    if (status === 'delivered') tsPatch['deliveredAt'] = now;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status, statusManual: true, ...tsPatch },
      include: {
        restaurant: { select: { name: true } },
        user: { select: { fullName: true, phone: true } },
      },
    });

    this.ws.broadcast({ type: 'order_update', order: { ...updated, subtotal: updated.subtotal.toString() } });

    return {
      ...updated,
      subtotal: updated.subtotal.toString(),
      restaurantName: updated.restaurant?.name ?? null,
      customerName: updated.user?.fullName ?? null,
      customerPhone: updated.user?.phone ?? null,
      restaurant: undefined,
      user: undefined,
    };
  }
}
