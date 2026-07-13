"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const prisma_service_1 = require("../prisma/prisma.service");
const STAFF_PASSCODE = process.env['STAFF_PASSCODE'] ?? 'feast-staff';
function normalizeSavedAddresses(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const entry of raw) {
        if (typeof entry === 'string') {
            const label = entry.trim();
            if (label)
                out.push({ label });
            continue;
        }
        if (entry && typeof entry === 'object') {
            const e = entry;
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
function serializeUser(user) {
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
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    signToken(payload) {
        return this.jwtService.sign(payload, { expiresIn: '30d' });
    }
    signStaffToken() {
        return this.jwtService.sign({ userId: 0, email: 'staff@feast', role: 'restaurant_staff' }, { expiresIn: '7d' });
    }
    async signup(body) {
        if (!body.fullName || !body.email || !body.password) {
            throw new Error('fullName, email, and password are required');
        }
        const existing = await this.prisma.user.findUnique({
            where: { email: body.email.toLowerCase() },
        });
        if (existing)
            throw new common_1.ConflictException('An account with this email already exists');
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
    async signin(body) {
        if (!body.email || !body.password) {
            throw new common_1.UnauthorizedException('email and password are required');
        }
        const user = await this.prisma.user.findUnique({
            where: { email: body.email.toLowerCase() },
        });
        if (!user)
            throw new common_1.UnauthorizedException('Invalid email or password');
        const valid = await bcrypt.compare(body.password, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid email or password');
        const token = this.signToken({ userId: user.id, email: user.email, role: user.role });
        return { token, user: serializeUser(user) };
    }
    staffLogin(passcode) {
        if (!passcode)
            throw new common_1.UnauthorizedException('passcode is required');
        if (passcode !== STAFF_PASSCODE)
            throw new common_1.UnauthorizedException('Invalid passcode');
        return { token: this.signStaffToken() };
    }
    async getMe(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return serializeUser(user);
    }
    async updateMe(userId, body) {
        const data = {};
        if (body.fullName !== undefined)
            data['fullName'] = body.fullName;
        if (body.phone !== undefined)
            data['phone'] = body.phone;
        if (body.zipCode !== undefined)
            data['zipCode'] = body.zipCode;
        if (body.savedAddresses !== undefined)
            data['savedAddresses'] = normalizeSavedAddresses(body.savedAddresses);
        if (body.preferences !== undefined)
            data['preferences'] = body.preferences;
        const user = await this.prisma.user.update({ where: { id: userId }, data });
        return serializeUser(user);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
