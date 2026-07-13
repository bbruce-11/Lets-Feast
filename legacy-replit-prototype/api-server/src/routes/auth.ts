import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, savedAddressSchema, type SavedAddress } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken, signStaffToken } from "../lib/jwt.js";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { signupSchema, signinSchema, updateMeSchema } from "../lib/schemas.js";

// Shared passcode for the restaurant staff dashboard. Falls back to a dev value
// (mirroring the JWT secret handling) so the dashboard works locally without
// extra setup; set STAFF_PASSCODE before deploying to production.
const STAFF_PASSCODE = process.env.STAFF_PASSCODE ?? "feast-staff";

const router: IRouter = Router();

// Saved addresses are stored as jsonb and may contain legacy plain strings or the
// newer { label, lat, lng } objects. Normalize both shapes to objects and drop
// anything malformed so the API always returns a consistent structure.
function normalizeSavedAddresses(raw: unknown): SavedAddress[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedAddress[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const label = entry.trim();
      if (label) out.push({ label });
      continue;
    }
    const parsed = savedAddressSchema.safeParse(entry);
    if (parsed.success) {
      const label = parsed.data.label.trim();
      if (label) {
        out.push({
          label,
          lat: parsed.data.lat ?? null,
          lng: parsed.data.lng ?? null,
        });
      }
    }
  }
  return out;
}

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: String(user.id),
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    zipCode: user.zipCode,
    role: user.role,
    membershipStatus: user.membershipStatus,
    referralCode: user.referralCode,
    savedAddresses: normalizeSavedAddresses(user.savedAddresses),
    preferences: user.preferences,
  };
}

router.post("/auth/signup", validateBody(signupSchema), async (req, res) => {
  try {
    const { fullName, phone, email, zipCode, password, referralCode } = req.body as {
      fullName: string;
      phone: string;
      email: string;
      zipCode: string;
      password: string;
      referralCode?: string;
    };

    if (!fullName || !email || !password) {
      res.status(400).json({ error: "fullName, email, and password are required" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({
        fullName,
        phone: phone ?? "",
        email: email.toLowerCase(),
        zipCode: zipCode ?? "",
        passwordHash,
        membershipStatus: "free",
        referralCode: referralCode ?? null,
        savedAddresses: [],
      })
      .returning();

    const token = signToken({ userId: user.id, email: user.email });
    res.status(201).json({ token, user: serializeUser(user) });
  } catch (err) {
    req.log.error({ err }, "signup error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/signin", validateBody(signinSchema), async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: serializeUser(user) });
  } catch (err) {
    req.log.error({ err }, "signin error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Restaurant staff dashboard login. Staff share a single passcode (no per-user
// accounts), so a correct passcode mints a short-lived staff-role token that
// unlocks the staff order endpoints. Intentionally lightweight per the task.
router.post("/auth/staff/login", async (req, res) => {
  try {
    const { passcode } = req.body as { passcode?: string };
    if (typeof passcode !== "string" || passcode.length === 0) {
      res.status(400).json({ error: "passcode is required" });
      return;
    }
    if (passcode !== STAFF_PASSCODE) {
      res.status(401).json({ error: "Invalid passcode" });
      return;
    }
    const token = signStaffToken();
    res.json({ token });
  } catch (err) {
    req.log.error({ err }, "staff login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(serializeUser(user));
  } catch (err) {
    req.log.error({ err }, "me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/auth/me", requireAuth, validateBody(updateMeSchema), async (req: AuthRequest, res) => {
  try {
    const { fullName, phone, zipCode, savedAddresses, preferences } = req.body as {
      fullName?: string;
      phone?: string;
      zipCode?: string;
      savedAddresses?: unknown;
      preferences?: unknown;
    };

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (phone !== undefined) updates.phone = phone;
    if (zipCode !== undefined) updates.zipCode = zipCode;
    if (savedAddresses !== undefined) {
      // Sanitize incoming addresses (strings or { label, lat, lng }) before persisting.
      updates.savedAddresses = normalizeSavedAddresses(savedAddresses);
    }
    if (preferences !== undefined) updates.preferences = preferences;

    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.user!.userId))
      .returning();

    res.json(serializeUser(user));
  } catch (err) {
    req.log.error({ err }, "update user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
