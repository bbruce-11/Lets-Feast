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
exports.RolesGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const roles_decorator_1 = require("../decorators/roles.decorator");
const prisma_service_1 = require("../../prisma/prisma.service");
let RolesGuard = class RolesGuard {
    constructor(reflector, prisma) {
        this.reflector = reflector;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const roles = this.reflector.getAllAndOverride(roles_decorator_1.ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!roles?.length)
            return true;
        const req = context.switchToHttp().getRequest();
        const user = req.user;
        if (!user)
            throw new common_1.UnauthorizedException();
        // The shared staff token has userId 0 and no corresponding DB row.
        // Trust its JWT-embedded role directly — DB lookup would fail.
        // All other token holders (real user accounts) go through DB revalidation
        // so that role changes take effect immediately without waiting for expiry.
        if (user.userId === 0 && user.role && roles.includes(user.role))
            return true;
        // For real user accounts fetch the role fresh from the DB so that
        // permission changes take effect without a new JWT.
        const dbUser = await this.prisma.user.findUnique({
            where: { id: user.userId },
            select: { role: true },
        });
        if (!dbUser)
            throw new common_1.UnauthorizedException();
        req.user = { ...user, role: dbUser.role };
        if (!roles.includes(dbUser.role))
            throw new common_1.ForbiddenException();
        return true;
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        prisma_service_1.PrismaService])
], RolesGuard);
