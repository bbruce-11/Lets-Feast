import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  userId: number;
  email: string;
  /** 'staff' on staff dashboard tokens; DB role value after RolesGuard runs. */
  role?: string;
}

// Minimal structural type covering the fields we read from the express Request.
// Avoids a hard dependency on @types/express in this package.
export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  user: JwtPayload;
  body?: unknown;
  params?: Record<string, string>;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayload => {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    return req.user;
  },
);
