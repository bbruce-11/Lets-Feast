import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WebSocket } from 'ws';
import type { Server as WsServer } from 'ws';
import { PrismaService } from '../prisma/prisma.service';
import {
  deriveDriverProgress,
  deriveEtaMinutes,
  deriveOrderStatus,
  etaForStatus,
  isTerminal,
  progressForStatus,
} from '../common/order-status.util';

interface TrackingRow {
  id: number;
  status: string;
  statusManual: boolean;
  createdAt: Date;
}

interface OrderTrackingPayload {
  id: number;
  status: string;
  driverProgress: number;
  etaMinutes: number;
}

@Injectable()
export class WsService implements OnModuleInit, OnModuleDestroy {
  /** Set by WsGateway.afterInit() once the ws.Server is ready. */
  private server: WsServer | null = null;
  private trackingInterval: ReturnType<typeof setInterval> | null = null;
  private readonly lastBroadcastStatus = new Map<number, string>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Start the periodic order-tracking broadcaster. Iterations that run before
    // the WsGateway's afterInit are harmless (clientCount() returns 0).
    this.trackingInterval = setInterval(() => {
      this.broadcastActiveOrderTracking().catch(() => {});
    }, 1_000);
  }

  onModuleDestroy(): void {
    if (this.trackingInterval) clearInterval(this.trackingInterval);
  }

  /** Called by WsGateway.afterInit() once the NestJS ws.Server is available. */
  onServerReady(server: WsServer): void {
    this.server = server;
  }

  broadcast(msg: object): void {
    if (!this.server) return;
    // Serialize BigInt as Number so feast-window endTime doesn't throw.
    const data = JSON.stringify(msg, (_k, v) => (typeof v === 'bigint' ? Number(v) : v));
    this.server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    });
  }

  broadcastOrderUpdate(order: TrackingRow): void {
    this.broadcast({ type: 'order_update', data: this.computeTracking(order) });
  }

  clientCount(): number {
    return this.server?.clients.size ?? 0;
  }

  private computeTracking(order: TrackingRow): OrderTrackingPayload {
    if (order.statusManual) {
      const delivered = order.status === 'delivered';
      return {
        id: order.id,
        status: order.status,
        driverProgress: delivered ? 1 : progressForStatus(order.status),
        etaMinutes: delivered ? 0 : etaForStatus(order.status),
      };
    }
    const status = deriveOrderStatus(order.createdAt);
    const delivered = status === 'delivered';
    return {
      id: order.id,
      status,
      driverProgress: delivered ? 1 : deriveDriverProgress(order.createdAt),
      etaMinutes: delivered ? 0 : deriveEtaMinutes(order.createdAt),
    };
  }

  private async broadcastActiveOrderTracking(): Promise<void> {
    if (this.clientCount() === 0) return;
    const since = new Date(Date.now() - 10 * 60_000);
    const rows = await this.prisma.order.findMany({
      where: { status: { not: 'cancelled' }, createdAt: { gte: since } },
      select: { id: true, status: true, statusManual: true, createdAt: true },
    });
    const seen = new Set<number>();
    for (const row of rows) {
      seen.add(row.id);
      const payload = this.computeTracking(row);
      if (isTerminal(payload.status)) {
        if (this.lastBroadcastStatus.get(row.id) === payload.status) continue;
      }
      this.lastBroadcastStatus.set(row.id, payload.status);
      this.broadcast({ type: 'order_update', data: payload });
    }
    for (const id of this.lastBroadcastStatus.keys()) {
      if (!seen.has(id)) this.lastBroadcastStatus.delete(id);
    }
  }
}
