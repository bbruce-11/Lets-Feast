import jwt from "jsonwebtoken";

const rawSecret = process.env.JWT_SECRET;
const isDev = process.env.NODE_ENV !== "production";

if (!rawSecret) {
  if (isDev) {
    console.warn(
      "[JWT] WARNING: JWT_SECRET env var not set — using insecure dev default. Set JWT_SECRET before deploying to production."
    );
  } else {
    throw new Error(
      "JWT_SECRET environment variable is required in production but was not set."
    );
  }
}

const JWT_SECRET = rawSecret ?? "feast-dev-secret-change-in-production";

export interface JwtPayload {
  userId: number;
  email: string;
  // Present on staff dashboard tokens. Customer tokens omit it. Staff tokens are
  // not tied to a real user row (userId is 0); they only grant the staff role.
  role?: "staff";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

// Issues a token for the restaurant staff dashboard. It carries the "staff" role
// (checked by requireStaff) rather than a real user id, since staff log in with a
// shared passcode rather than a user account.
export function signStaffToken(): string {
  return jwt.sign({ userId: 0, email: "staff@feast", role: "staff" }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
