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
exports.FeastWindowExpiryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ws_service_1 = require("../ws/ws.service");
/**
 * Mirrors artifacts/api-server/src/lib/expiry.ts.
 * On init (and every 60s) fetches all still-active feast windows and schedules
 * a setTimeout for each. When a timer fires it broadcasts `feast_window_expired`
 * over the WebSocket so connected clients can update their UI immediately.
 */
let FeastWindowExpiryService = class FeastWindowExpiryService {
    constructor(prisma, ws) {
        this.prisma = prisma;
        this.ws = ws;
        this.scheduled = new Map();
        this.rescanInterval = null;
    }
    onModuleInit() {
        // Initial scan at startup.
        this.scheduleExpiryBroadcasts().catch(() => { });
        // Re-scan every 60 s to pick up newly created feast windows.
        this.rescanInterval = setInterval(() => {
            this.scheduleExpiryBroadcasts().catch(() => { });
        }, 60_000);
    }
    onModuleDestroy() {
        if (this.rescanInterval)
            clearInterval(this.rescanInterval);
        for (const handle of this.scheduled.values())
            clearTimeout(handle);
        this.scheduled.clear();
    }
    scheduleOne(id, endTime) {
        if (this.scheduled.has(id))
            return;
        const delay = endTime - Date.now();
        if (delay <= 0) {
            this.ws.broadcast({ type: 'feast_window_expired', id });
            return;
        }
        const handle = setTimeout(() => {
            this.ws.broadcast({ type: 'feast_window_expired', id });
            this.scheduled.delete(id);
        }, delay);
        this.scheduled.set(id, handle);
    }
    async scheduleExpiryBroadcasts() {
        const now = Date.now();
        const active = await this.prisma.feastWindow.findMany({
            where: { endTime: { gt: BigInt(now) } },
            select: { id: true, endTime: true },
        });
        for (const row of active) {
            this.scheduleOne(row.id, Number(row.endTime));
        }
    }
};
exports.FeastWindowExpiryService = FeastWindowExpiryService;
exports.FeastWindowExpiryService = FeastWindowExpiryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ws_service_1.WsService])
], FeastWindowExpiryService);
