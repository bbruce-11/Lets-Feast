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
exports.FeastWindowsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ws_service_1 = require("../ws/ws.service");
let FeastWindowsService = class FeastWindowsService {
    constructor(prisma, ws) {
        this.prisma = prisma;
        this.ws = ws;
    }
    async list() {
        const rows = await this.prisma.feastWindow.findMany({
            where: { endTime: { gt: BigInt(Date.now()) } },
        });
        return rows.map(serializeFw);
    }
    async get(id) {
        const row = await this.prisma.feastWindow.findUnique({ where: { id } });
        if (!row)
            throw new common_1.NotFoundException('Feast window not found');
        return serializeFw(row);
    }
    async getJoined(userId) {
        const rows = await this.prisma.feastWindowMember.findMany({
            where: { userId },
            select: { feastWindowId: true },
        });
        return rows.map((r) => r.feastWindowId);
    }
    async join(feastWindowId, userId) {
        const now = Date.now();
        const result = await this.prisma.$transaction(async (tx) => {
            // Idempotency: reject if already joined
            const existing = await tx.feastWindowMember.findFirst({
                where: { feastWindowId, userId },
            });
            if (existing) {
                return { status: 409, error: "You've already joined this feast window" };
            }
            // Atomically increment spots_filled only when under capacity and not expired.
            // Column comparison (spotsFilled < spotsTotal) requires raw SQL in Prisma.
            const updateCount = await tx.$executeRaw `
        UPDATE feast_windows
        SET spots_filled = spots_filled + 1
        WHERE id = ${feastWindowId}
          AND spots_filled < spots_total
          AND end_time > ${BigInt(now)}::bigint
      `;
            if (updateCount === 0) {
                const current = await tx.feastWindow.findUnique({ where: { id: feastWindowId } });
                if (!current)
                    return { status: 404, error: 'Feast window not found' };
                if (Number(current.endTime) <= now)
                    return { status: 410, error: 'This feast window has expired' };
                return { status: 409, error: 'This feast window is full' };
            }
            await tx.feastWindowMember.create({ data: { feastWindowId, userId } });
            const updated = await tx.feastWindow.findUnique({ where: { id: feastWindowId } });
            return { status: 200, row: serializeFw(updated) };
        });
        if (result.status !== 200) {
            const err = result;
            if (err.status === 404)
                throw new common_1.NotFoundException(err.error);
            if (err.status === 410)
                throw new common_1.GoneException(err.error);
            throw new common_1.ConflictException(err.error);
        }
        const { row } = result;
        this.ws.broadcast({ type: 'feast_window_update', data: row });
        if (row.spotsFilled >= row.spotsTotal) {
            this.ws.broadcast({ type: 'feast_window_full', id: row.id });
        }
        else {
            const unlockThreshold = Math.ceil(row.spotsTotal / 2);
            const previousFilled = row.spotsFilled - 1;
            if (previousFilled < unlockThreshold && row.spotsFilled >= unlockThreshold) {
                this.ws.broadcast({
                    type: 'feast_window_discount_unlocked',
                    id: row.id,
                    discount: row.discount,
                });
            }
        }
        return row;
    }
};
exports.FeastWindowsService = FeastWindowsService;
exports.FeastWindowsService = FeastWindowsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ws_service_1.WsService])
], FeastWindowsService);
function serializeFw(fw) {
    return {
        ...fw,
        endTime: Number(fw.endTime),
        discount: String(fw.discount),
    };
}
