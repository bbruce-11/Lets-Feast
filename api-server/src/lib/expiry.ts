import { db } from "@workspace/db";
import { feastWindowsTable } from "@workspace/db/schema";
import { gt } from "drizzle-orm";
import { broadcast } from "./ws";
import { logger } from "./logger";

const scheduled = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleOne(id: string, endTime: number): void {
  if (scheduled.has(id)) return;
  const delay = endTime - Date.now();
  if (delay <= 0) {
    broadcast({ type: "feast_window_expired", id });
    return;
  }
  const handle = setTimeout(() => {
    broadcast({ type: "feast_window_expired", id });
    scheduled.delete(id);
  }, delay);
  scheduled.set(id, handle);
}

export async function scheduleExpiryBroadcasts(): Promise<void> {
  try {
    const now = Date.now();
    const active = await db
      .select({ id: feastWindowsTable.id, endTime: feastWindowsTable.endTime })
      .from(feastWindowsTable)
      .where(gt(feastWindowsTable.endTime, now));

    for (const row of active) {
      scheduleOne(row.id, row.endTime);
    }
  } catch (err) {
    logger.error({ err }, "expiry schedule query error");
  }
}
