import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

// Expo's hosted push service. Sending here delivers to APNs/FCM so the customer
// is notified even when the app is backgrounded or fully closed.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: string;
  details?: { error?: string };
}

// Sends a push notification to every device registered for the given user.
// Tokens that Expo reports as no longer registered are pruned so we stop trying
// to reach uninstalled apps. Failures are logged but never throw — notification
// delivery must not break the request/timer that triggered it.
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  let tokens: string[];
  try {
    const rows = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(eq(pushTokensTable.userId, userId));
    tokens = rows.map((r) => r.token).filter(isExpoPushToken);
  } catch (err) {
    logger.error({ err, userId }, "push token lookup failed");
    return;
  }

  if (tokens.length === 0) {
    logger.info({ userId, title: payload.title }, "no push tokens registered; skipping push");
    return;
  }

  const messages = tokens.map((to) => ({
    to,
    sound: "default" as const,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      logger.error({ status: res.status, userId }, "expo push request failed");
      return;
    }

    const json = (await res.json()) as { data?: ExpoTicket[] };
    const tickets = json.data ?? [];
    const stale: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        const token = tokens[i];
        if (token) stale.push(token);
      }
    });

    if (stale.length > 0) {
      await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, stale));
      logger.info({ count: stale.length }, "pruned unregistered push tokens");
    }

    logger.info({ userId, count: tokens.length, title: payload.title }, "push notification sent");
  } catch (err) {
    logger.error({ err, userId }, "expo push send failed");
  }
}
