import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { feastWindowsTable, feastWindowMembersTable } from "@workspace/db/schema";
import { eq, gt, and, lt, sql } from "drizzle-orm";
import { broadcast } from "../lib/ws";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/feast-windows", async (req, res) => {
  try {
    const now = Date.now();
    const rows = await db
      .select()
      .from(feastWindowsTable)
      .where(gt(feastWindowsTable.endTime, now));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list feast-windows error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/feast-windows/:id", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(feastWindowsTable)
      .where(eq(feastWindowsTable.id, req.params.id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Feast window not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "get feast-window error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/feast-windows/me/joined", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({ feastWindowId: feastWindowMembersTable.feastWindowId })
      .from(feastWindowMembersTable)
      .where(eq(feastWindowMembersTable.userId, req.user!.userId));
    res.json(rows.map((r) => r.feastWindowId));
  } catch (err) {
    req.log.error({ err }, "list joined feast-windows error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/feast-windows/:id/join", requireAuth, async (req: AuthRequest, res) => {
  try {
    const now = Date.now();
    const userId = req.user!.userId;
    // Express types a route param as `string | string[]`; this route's `:id` is
    // always a single value, so coerce to a plain string for the DB queries.
    const feastWindowId = String(req.params.id);

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(feastWindowMembersTable)
        .where(
          and(
            eq(feastWindowMembersTable.feastWindowId, feastWindowId),
            eq(feastWindowMembersTable.userId, userId),
          ),
        )
        .limit(1);

      if (existing) {
        return { status: 409 as const, error: "You've already joined this feast window" };
      }

      const [updated] = await tx
        .update(feastWindowsTable)
        .set({ spotsFilled: sql`${feastWindowsTable.spotsFilled} + 1` })
        .where(
          and(
            eq(feastWindowsTable.id, feastWindowId),
            lt(feastWindowsTable.spotsFilled, feastWindowsTable.spotsTotal),
            gt(feastWindowsTable.endTime, now),
          ),
        )
        .returning();

      if (!updated) {
        const [current] = await tx
          .select()
          .from(feastWindowsTable)
          .where(eq(feastWindowsTable.id, feastWindowId))
          .limit(1);

        if (!current) {
          return { status: 404 as const, error: "Feast window not found" };
        }
        if (now > current.endTime) {
          return { status: 410 as const, error: "This feast window has expired" };
        }
        return { status: 409 as const, error: "This feast window is full" };
      }

      await tx.insert(feastWindowMembersTable).values({ feastWindowId, userId });

      return { status: 200 as const, updated };
    });

    if (result.status !== 200) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const { updated } = result;
    broadcast({ type: "feast_window_update", data: updated });

    if (updated.spotsFilled >= updated.spotsTotal) {
      broadcast({ type: "feast_window_full", id: updated.id });
    } else {
      // The group deal unlocks once enough people join (half the spots). Fire a
      // celebratory broadcast on the single join that first crosses that
      // threshold, so it announces exactly once per window.
      const unlockThreshold = Math.ceil(updated.spotsTotal / 2);
      const previousFilled = updated.spotsFilled - 1;
      if (previousFilled < unlockThreshold && updated.spotsFilled >= unlockThreshold) {
        broadcast({
          type: "feast_window_discount_unlocked",
          id: updated.id,
          discount: updated.discount,
        });
      }
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "join feast-window error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
