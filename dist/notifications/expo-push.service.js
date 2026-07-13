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
exports.ExpoPushService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
function isExpoPushToken(token) {
    return /^Expo(nent)?PushToken\[.+\]$/.test(token);
}
let ExpoPushService = class ExpoPushService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    isValidToken(token) {
        return isExpoPushToken(token);
    }
    /** Sends a push to every registered device for the given user; prunes stale tokens. */
    async sendToUser(userId, payload) {
        let tokens;
        try {
            const rows = await this.prisma.pushToken.findMany({
                where: { userId },
                select: { token: true },
            });
            tokens = rows.map((r) => r.token).filter(isExpoPushToken);
        }
        catch {
            return;
        }
        if (!tokens.length)
            return;
        const messages = tokens.map((to) => ({
            to,
            sound: 'default',
            title: payload.title,
            body: payload.body,
            data: payload.data ?? {},
        }));
        try {
            const res = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(messages),
            });
            if (!res.ok)
                return;
            const json = (await res.json());
            const stale = (json.data ?? [])
                .map((t, i) => t.status === 'error' && t.details?.error === 'DeviceNotRegistered'
                ? tokens[i]
                : null)
                .filter((t) => t != null);
            if (stale.length > 0)
                await this.prisma.pushToken.deleteMany({ where: { token: { in: stale } } });
        }
        catch {
            // Push failures must never surface to callers
        }
    }
};
exports.ExpoPushService = ExpoPushService;
exports.ExpoPushService = ExpoPushService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExpoPushService);
