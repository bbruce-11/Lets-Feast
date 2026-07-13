import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: string;
  details?: { error?: string };
}

function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

@Injectable()
export class ExpoPushService {
  constructor(private readonly prisma: PrismaService) {}

  isValidToken(token: string): boolean {
    return isExpoPushToken(token);
  }

  /** Sends a push to every registered device for the given user; prunes stale tokens. */
  async sendToUser(userId: number, payload: PushPayload): Promise<void> {
    let tokens: string[];
    try {
      const rows = await this.prisma.pushToken.findMany({
        where: { userId },
        select: { token: true },
      });
      tokens = rows.map((r) => r.token).filter(isExpoPushToken);
    } catch {
      return;
    }
    if (!tokens.length) return;

    const messages = tokens.map((to) => ({
      to,
      sound: 'default' as const,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { data?: ExpoTicket[] };
      const stale = (json.data ?? [])
        .map((t, i) =>
          t.status === 'error' && t.details?.error === 'DeviceNotRegistered'
            ? tokens[i]
            : null,
        )
        .filter((t): t is string => t != null);
      if (stale.length > 0)
        await this.prisma.pushToken.deleteMany({ where: { token: { in: stale } } });
    } catch {
      // Push failures must never surface to callers
    }
  }
}
