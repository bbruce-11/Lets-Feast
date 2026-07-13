import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService, PushPayload } from './expo-push.service';
import { OFFSETS_MS } from '../common/order-status.util';

const NOTIFY_STATUSES = ['preparing', 'driver_assigned', 'on_the_way', 'delivered'] as const;
type NotifyStatus = (typeof NOTIFY_STATUSES)[number];

const COPY: Record<NotifyStatus, Pick<PushPayload, 'title' | 'body'>> = {
  preparing: {
    title: '👨‍🍳 Your order is being prepared',
    body: 'The kitchen has started cooking up your feast.',
  },
  driver_assigned: {
    title: '🚗 Driver assigned',
    body: 'Your driver is heading to the restaurant to pick up your order.',
  },
  on_the_way: {
    title: '🍽️ Your feast is on the way',
    body: 'Your order has been picked up and is heading to you.',
  },
  delivered: {
    title: '🎉 Delivered!',
    body: 'Your feast has arrived. Enjoy!',
  },
};

export const ACTIVE_WINDOW_MS = 12_000;
export const MAX_CATCHUP_AGE_MS = 5 * 60_000;

function statusIndex(status: string | null): number {
  if (!status) return -1;
  return (NOTIFY_STATUSES as readonly string[]).indexOf(status);
}

function toMs(value: Date | null): number | null {
  if (!value) return null;
  const ms = value.getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function shouldPush(
  activationMs: number,
  now: number,
  lastPolledMs: number | null,
): boolean {
  if (now - activationMs > MAX_CATCHUP_AGE_MS) return false;
  if (lastPolledMs != null && now - lastPolledMs <= ACTIVE_WINDOW_MS) return false;
  if (lastPolledMs != null && activationMs <= lastPolledMs) return false;
  return true;
}

type OrderRow = {
  id: number;
  userId: number;
  createdAt: Date;
  status: string;
  statusManual: boolean;
  notifiedStatus: string | null;
  lastPolledAt: Date | null;
};

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly handling = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: ExpoPushService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.scheduleOrderNotifications();
    setInterval(() => {
      this.scheduleOrderNotifications().catch(() => {});
    }, 60_000);
  }

  /** Scans all pending-notification orders and (re)schedules timers for each. */
  async scheduleOrderNotifications(): Promise<void> {
    const rows = await this.prisma.order
      .findMany({
        where: {
          status: { not: 'cancelled' },
          OR: [{ notifiedStatus: null }, { notifiedStatus: { not: 'delivered' } }],
        },
        select: { id: true },
      })
      .catch(() => []);
    for (const row of rows) this.scheduleOrderById(row.id);
  }

  /** Called right after order creation so notifications are scheduled immediately. */
  scheduleOrderById(orderId: number): void {
    void this.scheduleOrder(orderId).catch(() => {});
  }

  /** Sends the customer push for a manually-set status; reuses the same dedup rules. */
  notifyManualStatus(orderId: number, status: string): void {
    void this.notifyManualStatusInner(orderId, status).catch(() => {});
  }

  /** Cancel any pending timers for an order that has reached a terminal status. */
  cancelScheduledOrder(orderId: number): void {
    this.clearTimer(orderId);
    this.handling.delete(orderId);
  }

  private clearTimer(orderId: number): void {
    const h = this.timers.get(orderId);
    if (h) { clearTimeout(h); this.timers.delete(orderId); }
  }

  private async scheduleOrder(orderId: number): Promise<void> {
    if (this.handling.has(orderId)) return;
    this.handling.add(orderId);
    try {
      let order = await this.fetchOrder(orderId);
      if (!order || order.status === 'cancelled' || order.statusManual) {
        this.clearTimer(orderId);
        return;
      }
      const createdMs = toMs(order.createdAt);
      if (!createdMs) { this.clearTimer(orderId); return; }

      for (let i = statusIndex(order.notifiedStatus) + 1; i < NOTIFY_STATUSES.length; i++) {
        const status = NOTIFY_STATUSES[i]!;
        const activationMs = createdMs + OFFSETS_MS[status];
        const now = Date.now();
        const delay = activationMs - now;

        if (delay > 0) {
          this.clearTimer(orderId);
          const h = setTimeout(() => {
            this.timers.delete(orderId);
            void this.scheduleOrder(orderId).catch(() => {});
          }, delay);
          this.timers.set(orderId, h);
          return;
        }

        const lastPolledMs = toMs(order.lastPolledAt);
        if (shouldPush(activationMs, now, lastPolledMs)) {
          const copy = COPY[status];
          await this.push.sendToUser(order.userId, {
            title: copy.title,
            body: copy.body,
            data: { type: 'order_status', orderId: order.id, status },
          });
        }

        await this.prisma.order.update({
          where: { id: order.id },
          data: { notifiedStatus: status, updatedAt: new Date() },
        });
        order = { ...order, notifiedStatus: status };
      }
      this.clearTimer(orderId);
    } finally {
      this.handling.delete(orderId);
    }
  }

  private async notifyManualStatusInner(orderId: number, status: string): Promise<void> {
    if (this.handling.has(orderId)) return;
    this.handling.add(orderId);
    try {
      const order = await this.fetchOrder(orderId);
      if (!order) return;
      this.clearTimer(orderId);
      const idx = statusIndex(status);
      if (idx < 0 || idx <= statusIndex(order.notifiedStatus)) return;
      const now = Date.now();
      const lastPolledMs = toMs(order.lastPolledAt);
      if (shouldPush(now, now, lastPolledMs)) {
        const copy = COPY[status as NotifyStatus];
        if (copy) {
          await this.push.sendToUser(order.userId, {
            title: copy.title,
            body: copy.body,
            data: { type: 'order_status', orderId: order.id, status },
          });
        }
      }
      await this.prisma.order.update({
        where: { id: order.id },
        data: { notifiedStatus: status, updatedAt: new Date() },
      });
    } finally {
      this.handling.delete(orderId);
    }
  }

  private fetchOrder(orderId: number): Promise<OrderRow | null> {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        status: true,
        statusManual: true,
        notifiedStatus: true,
        lastPolledAt: true,
      },
    });
  }
}
