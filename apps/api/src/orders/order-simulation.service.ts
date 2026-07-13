import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WsService } from '../ws/ws.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  deriveOrderStatus,
  isTerminal,
} from '../common/order-status.util';

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

/**
 * Runs every 5 s and auto-advances non-manual, non-terminal orders based on
 * elapsed time since createdAt. This makes order progression deterministic and
 * independent of read traffic — any active order will advance even if no client
 * polls for it.
 *
 * Mirrors the intent of artifacts/api-server/src/lib/orderStatus.ts but runs
 * as an explicit Nest scheduled task rather than being derived lazily on reads.
 */
@Injectable()
export class OrderSimulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: WsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Interval(5_000)
  async tick(): Promise<void> {
    const cutoff = new Date(Date.now() - 10 * 60_000);
    const orders = await this.prisma.order.findMany({
      where: {
        statusManual: false,
        status: { notIn: ['delivered', 'cancelled'] },
        createdAt: { gte: cutoff },
      },
      select: { id: true, status: true, createdAt: true },
    });

    for (const order of orders) {
      const derived = deriveOrderStatus(order.createdAt);
      if (derived === order.status) continue;

      const updated = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: derived,
          updatedAt: new Date(),
          ...tsPatch(derived),
        } as Prisma.OrderUpdateInput,
      });

      // Notify push + WS on every status transition.
      this.notifications.notifyManualStatus(order.id, derived);
      this.ws.broadcastOrderUpdate(updated);

      // If the order just became terminal, stop scheduling further push reminders.
      if (isTerminal(derived)) {
        this.notifications.cancelScheduledOrder(order.id);
      }
    }
  }
}
