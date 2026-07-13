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
exports.WsService = void 0;
const common_1 = require("@nestjs/common");
const ws_1 = require("ws");
const prisma_service_1 = require("../prisma/prisma.service");
const order_status_util_1 = require("../common/order-status.util");
let WsService = class WsService {
    constructor(prisma) {
        this.prisma = prisma;
        /** Set by WsGateway.afterInit() once the ws.Server is ready. */
        this.server = null;
        this.trackingInterval = null;
        this.lastBroadcastStatus = new Map();
    }
    onModuleInit() {
        // Start the periodic order-tracking broadcaster. Iterations that run before
        // the WsGateway's afterInit are harmless (clientCount() returns 0).
        this.trackingInterval = setInterval(() => {
            this.broadcastActiveOrderTracking().catch(() => { });
        }, 1_000);
    }
    onModuleDestroy() {
        if (this.trackingInterval)
            clearInterval(this.trackingInterval);
    }
    /** Called by WsGateway.afterInit() once the NestJS ws.Server is available. */
    onServerReady(server) {
        this.server = server;
    }
    broadcast(msg) {
        if (!this.server)
            return;
        // Serialize BigInt as Number so feast-window endTime doesn't throw.
        const data = JSON.stringify(msg, (_k, v) => (typeof v === 'bigint' ? Number(v) : v));
        this.server.clients.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN)
                client.send(data);
        });
    }
    broadcastOrderUpdate(order) {
        this.broadcast({ type: 'order_update', data: this.computeTracking(order) });
    }
    clientCount() {
        return this.server?.clients.size ?? 0;
    }
    computeTracking(order) {
        if (order.statusManual) {
            const delivered = order.status === 'delivered';
            return {
                id: order.id,
                status: order.status,
                driverProgress: delivered ? 1 : (0, order_status_util_1.progressForStatus)(order.status),
                etaMinutes: delivered ? 0 : (0, order_status_util_1.etaForStatus)(order.status),
            };
        }
        const status = (0, order_status_util_1.deriveOrderStatus)(order.createdAt);
        const delivered = status === 'delivered';
        return {
            id: order.id,
            status,
            driverProgress: delivered ? 1 : (0, order_status_util_1.deriveDriverProgress)(order.createdAt),
            etaMinutes: delivered ? 0 : (0, order_status_util_1.deriveEtaMinutes)(order.createdAt),
        };
    }
    async broadcastActiveOrderTracking() {
        if (this.clientCount() === 0)
            return;
        const since = new Date(Date.now() - 10 * 60_000);
        const rows = await this.prisma.order.findMany({
            where: { status: { not: 'cancelled' }, createdAt: { gte: since } },
            select: { id: true, status: true, statusManual: true, createdAt: true },
        });
        const seen = new Set();
        for (const row of rows) {
            seen.add(row.id);
            const payload = this.computeTracking(row);
            if ((0, order_status_util_1.isTerminal)(payload.status)) {
                if (this.lastBroadcastStatus.get(row.id) === payload.status)
                    continue;
            }
            this.lastBroadcastStatus.set(row.id, payload.status);
            this.broadcast({ type: 'order_update', data: payload });
        }
        for (const id of this.lastBroadcastStatus.keys()) {
            if (!seen.has(id))
                this.lastBroadcastStatus.delete(id);
        }
    }
};
exports.WsService = WsService;
exports.WsService = WsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WsService);
