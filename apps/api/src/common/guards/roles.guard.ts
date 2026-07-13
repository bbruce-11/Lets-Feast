import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthRequest } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const req = context.switchToHttp().getRequest<AuthRequest>();
    const user = req.user;
    if (!user) throw new UnauthorizedException();

    // The shared staff token has userId 0 and no corresponding DB row.
    // Trust its JWT-embedded role directly — DB lookup would fail.
    // All other token holders (real user accounts) go through DB revalidation
    // so that role changes take effect immediately without waiting for expiry.
    if (user.userId === 0 && user.role && roles.includes(user.role)) return true;

    // For real user accounts fetch the role fresh from the DB so that
    // permission changes take effect without a new JWT.
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { role: true },
    });
    if (!dbUser) throw new UnauthorizedException();

    req.user = { ...user, role: dbUser.role };
    if (!roles.includes(dbUser.role)) throw new ForbiddenException();
    return true;
  }
}
