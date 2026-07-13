import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';

// SECURITY: this passcode grants `restaurant_staff` role platform-wide (see
// RolesGuard's userId===0 branch, which trusts it without a DB lookup). It must
// never fall back to a guessable default in production. Mirrors the JWT_SECRET
// pattern in app.module.ts. TODO(Phase 2): replace with a per-restaurant, hashed
// credential instead of one shared platform-wide passcode.
const STAFF_PASSCODE = (() => {
  const value = process.env['STAFF_PASSCODE'];
  if (value) return value;
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('STAFF_PASSCODE environment variable is required in production');
  }
  return 'feast-staff'; // dev-only fallback
})();

interface SavedAddress {
  label: string;
  lat?: number | null;
  lng?: number | null;
}

function normalizeSavedAddresses(raw: unknown): SavedAddress[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedAddress[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const label = entry.trim();
      if (label) out.push({ label });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const e = entry as Record<string, unknown>;
      const label = typeof e['label'] === 'string' ? e['label'].trim() : '';
      if (label) {
        out.push({
          label,
          lat: typeof e['lat'] === 'number' ? e['lat'] : null,
          lng: typeof e['lng'] === 'number' ? e['lng'] : null,
        });
      }
    }
  }
  return out;
}

function serializeUser(user: User) {
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private signToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, { expiresIn: '30d' });
  }

  private signStaffToken(): string {
    return this.jwtService.sign(
      { userId: 0, email: 'staff@feast', role: 'restaurant_staff' } satisfies JwtPayload,
      { expiresIn: '7d' },
    );
  }

  async signup(body: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    zipCode?: string;
    referralCode?: string | null;
  }) {
    if (!body.fullName || !body.email || !body.password) {
      throw new Error('fullName, email, and password are required');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await this.prisma.user.create({
      data: {
        fullName: body.fullName,
        phone: body.phone ?? '',
        email: body.email.toLowerCase(),
        zipCode: body.zipCode ?? '',
        passwordHash,
        membershipStatus: 'free',
        referralCode: body.referralCode ?? null,
        savedAddresses: [],
      },
    });

    const token = this.signToken({ userId: user.id, email: user.email, role: user.role });
    return { token, user: serializeUser(user) };
  }

  async signin(body: { email: string; password: string }) {
    if (!body.email || !body.password) {
      throw new UnauthorizedException('email and password are required');
    }
    const user = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const token = this.signToken({ userId: user.id, email: user.email, role: user.role });
    return { token, user: serializeUser(user) };
  }

  staffLogin(passcode: string) {
    if (!passcode) throw new UnauthorizedException('passcode is required');
    if (passcode !== STAFF_PASSCODE) throw new UnauthorizedException('Invalid passcode');
    return { token: this.signStaffToken() };
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return serializeUser(user);
  }

  async updateMe(
    userId: number,
    body: {
      fullName?: string;
      phone?: string;
      zipCode?: string;
      savedAddresses?: unknown;
      preferences?: unknown;
    },
  ) {
    const data: Record<string, unknown> = {};
    if (body.fullName !== undefined) data['fullName'] = body.fullName;
    if (body.phone !== undefined) data['phone'] = body.phone;
    if (body.zipCode !== undefined) data['zipCode'] = body.zipCode;
    if (body.savedAddresses !== undefined)
      data['savedAddresses'] = normalizeSavedAddresses(body.savedAddresses);
    if (body.preferences !== undefined) data['preferences'] = body.preferences;

    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return serializeUser(user);
  }
}
