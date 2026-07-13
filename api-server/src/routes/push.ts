import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { registerPushTokenSchema, unregisterPushTokenSchema } from "../lib/schemas.js";
import { isExpoPushToken } from "../lib/push.js";

const router: IRouter = Router();

// Registers (or re-points) an Expo push token for the authenticated user. The
// token is the primary key, so a device re-registering after re-login simply
// moves the token to the current user.
router.post("/push/tokens", requireAuth, validateBody(registerPushTokenSchema), async (req: AuthRequest, res) => {
  try {
    const { token, platform } = req.body as { token?: string; platform?: string };
    if (typeof token !== "string" || !isExpoPushToken(token)) {
      res.status(400).json({ error: "A valid Expo push token is required" });
      return;
    }

    const platformValue = typeof platform === "string" ? platform : null;
    await db
      .insert(pushTokensTable)
      .values({
        token,
        userId: req.user!.userId,
        platform: platformValue,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pushTokensTable.token,
        set: { userId: req.user!.userId, platform: platformValue, updatedAt: new Date() },
      });

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "register push token error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Unregisters a token (e.g. on sign-out) so a shared device stops receiving the
// previous user's order notifications.
router.delete("/push/tokens", requireAuth, validateBody(unregisterPushTokenSchema), async (req: AuthRequest, res) => {
  try {
    const { token } = req.body as { token?: string };
    if (typeof token === "string") {
      await db
        .delete(pushTokensTable)
        .where(and(eq(pushTokensTable.token, token), eq(pushTokensTable.userId, req.user!.userId)));
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "unregister push token error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
