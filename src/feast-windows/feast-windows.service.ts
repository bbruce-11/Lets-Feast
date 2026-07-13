import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WsService } from '../ws/ws.service';

@Injectable()
export class FeastWindowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: WsService,
  ) {}

  async list() {
    const rows = await this.prisma.feastWindow.findMany({
      where: { endTime: { gt: BigInt(Date.now()) } },
    });
    return rows.map(serializeFw);
  }

  async get(id: string) {
    const row = await this.prisma.feastWindow.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Feast window not found');
    return serializeFw(row);
  }

  async getJoined(userId: number) {
    const rows = await this.prisma.feastWindowMember.findMany({
      where: { userId },
      select: { feastWindowId: true },
    });
    return rows.map((r) => r.feastWindowId);
  }

  async join(feastWindowId: string, userId: number) {
    const now = Date.now();

    type JoinResult =
      | { status: 409; error: string }
      | { status: 404; error: string }
      | { status: 410; error: string }
      | { status: 200; row: ReturnType<typeof serializeFw> };

    const result = await this.prisma.$transaction(async (tx) => {
      // Idempotency: reject if already joined
      const existing = await tx.feastWindowMember.findFirst({
        where: { feastWindowId, userId },
      });
      if (existing) {
        return { status: 409 as const, error: "You've already joined this feast window" };
      }

      // Atomically increment spots_filled only when under capacity and not expired.
      // Column comparison (spotsFilled < spotsTotal) requires raw SQL in Prisma.
      const updateCount = await tx.$executeRaw`
        UPDATE feast_windows
        SET spots_filled = spots_filled + 1
        WHERE id = ${feastWindowId}
          AND spots_filled < spots_total
          AND end_time > ${BigInt(now)}::bigint
      `;

      if (updateCount === 0) {
        const current = await tx.feastWindow.findUnique({ where: { id: feastWindowId } });
        if (!current) return { status: 404 as const, error: 'Feast window not found' };
        if (Number(current.endTime) <= now)
          return { status: 410 as const, error: 'This feast window has expired' };
        return { status: 409 as const, error: 'This feast window is full' };
      }

      await tx.feastWindowMember.create({ data: { feastWindowId, userId } });
      const updated = await tx.feastWindow.findUnique({ where: { id: feastWindowId } });
      return { status: 200 as const, row: serializeFw(updated!) };
    }) as JoinResult;

    if (result.status !== 200) {
      const err = result as { status: 409 | 404 | 410; error: string };
      if (err.status === 404) throw new NotFoundException(err.error);
      if (err.status === 410) throw new GoneException(err.error);
      throw new ConflictException(err.error);
    }

    const { row } = result as { status: 200; row: ReturnType<typeof serializeFw> };

    this.ws.broadcast({ type: 'feast_window_update', data: row });

    if (row.spotsFilled >= row.spotsTotal) {
      this.ws.broadcast({ type: 'feast_window_full', id: row.id });
    } else {
      const unlockThreshold = Math.ceil(row.spotsTotal / 2);
      const previousFilled = row.spotsFilled - 1;
      if (previousFilled < unlockThreshold && row.spotsFilled >= unlockThreshold) {
        this.ws.broadcast({
          type: 'feast_window_discount_unlocked',
          id: row.id,
          discount: row.discount,
        });
      }
    }

    return row;
  }
}

function serializeFw(
  fw: Prisma.FeastWindowGetPayload<Record<string, never>>,
): Omit<typeof fw, 'endTime' | 'discount'> & { endTime: number; discount: string } {
  return {
    ...fw,
    endTime: Number(fw.endTime),
    discount: String(fw.discount),
  };
}
