import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WsService } from '../ws/ws.service';

/**
 * Mirrors artifacts/api-server/src/lib/expiry.ts.
 * On init (and every 60s) fetches all still-active feast windows and schedules
 * a setTimeout for each. When a timer fires it broadcasts `feast_window_expired`
 * over the WebSocket so connected clients can update their UI immediately.
 */
@Injectable()
export class FeastWindowExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly scheduled = new Map<string, ReturnType<typeof setTimeout>>();
  private rescanInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: WsService,
  ) {}

  onModuleInit(): void {
    // Initial scan at startup.
    this.scheduleExpiryBroadcasts().catch(() => {});
    // Re-scan every 60 s to pick up newly created feast windows.
    this.rescanInterval = setInterval(() => {
      this.scheduleExpiryBroadcasts().catch(() => {});
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.rescanInterval) clearInterval(this.rescanInterval);
    for (const handle of this.scheduled.values()) clearTimeout(handle);
    this.scheduled.clear();
  }

  private scheduleOne(id: string, endTime: number): void {
    if (this.scheduled.has(id)) return;
    const delay = endTime - Date.now();
    if (delay <= 0) {
      this.ws.broadcast({ type: 'feast_window_expired', id });
      return;
    }
    const handle = setTimeout(() => {
      this.ws.broadcast({ type: 'feast_window_expired', id });
      this.scheduled.delete(id);
    }, delay);
    this.scheduled.set(id, handle);
  }

  async scheduleExpiryBroadcasts(): Promise<void> {
    const now = Date.now();
    const active = await this.prisma.feastWindow.findMany({
      where: { endTime: { gt: BigInt(now) } },
      select: { id: true, endTime: true },
    });
    for (const row of active) {
      this.scheduleOne(row.id, Number(row.endTime));
    }
  }
}
