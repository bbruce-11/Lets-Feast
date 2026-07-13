import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, JwtPayload } from "../lib/jwt.js";

export interface AuthRequest extends Request {
  // `role` is widened to string because requireRole refreshes it from the DB
  // (any role value), whereas the JWT only ever carries the literal "staff".
  user?: Omit<JwtPayload, "role"> & { role?: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Authorization guard: allows the request through only if the authenticated
// user's role is one of `allowed`. The role is read fresh from the database (not
// the JWT) so role changes take effect immediately and stale tokens can't carry
// elevated access. Must run after `requireAuth`.
export function requireRole(...allowed: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const [user] = await db
        .select({ role: usersTable.role })
        .from(usersTable)
        .where(eq(usersTable.id, req.user.userId))
        .limit(1);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!allowed.includes(user.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      req.user.role = user.role;
      next();
    } catch (err) {
      req.log?.error({ err }, "requireRole error");
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

// Guards the restaurant staff dashboard endpoints. Requires a valid token that
// carries the "staff" role (issued by POST /auth/staff/login). Customer tokens
// are rejected with 403 so diners can't reach the staff order list.
export function requireStaff(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    if (payload.role !== "staff") {
      res.status(403).json({ error: "Staff access required" });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
