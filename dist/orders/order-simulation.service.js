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
exports.OrderSimulationService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const ws_service_1 = require("../ws/ws.service");
const notifications_service_1 = require("../notifications/notifications.service");
const order_status_util_1 = require("../common/order-status.util");
function tsPatch(status) {
    const now = new Date();
    switch (status) {
        case 'confirmed': return { confirmedAt: now };
        case 'preparing': return { preparingAt: now };
        case 'driver_assigned': return { driverAssignedAt: now };
        case 'on_the_way': return { onTheWayAt: now };
        case 'delivered': return { deliveredAt: now };
        case 'cancelled': return { cancelledAt: now };
        default: return {};
    }
}
/**
 * Runs every 5 s and auto-advances non-manual, non-terminal orders based on
 * elapsed time since createdAt. This makes order progression deterministic and
 * independent of read traffic — any active order will advance even if no client
 * polls for it.
 *
 * Mirrors the intent of artifacts/api-server/src/lib/orderStatus.ts but runs
 * as an explicit Nest scheduled task rather than being derived lazily on reads.
 */
let OrderSimulationService = class OrderSimulationService {
    constructor(prisma, ws, notifications) {
        this.prisma = prisma;
        this.ws = ws;
        this.notifications = notifications;
    }
    async tick() {
        const cutoff = new Date(Date.now() - 10 * 60_000);
        const orders = await this.prisma.order.findMany({
            where: {
                statusManual: false,
                status: { notIn: ['delivered', 'cancelled'] },
                createdAt: { gte: cutoff },
            },
            select: { id: true, status: true, createdAt: true },
        });
        for (const order of orders) {
            const derived = (0, order_status_util_1.deriveOrderStatus)(order.createdAt);
            if (derived === order.status)
                continue;
            const updated = await this.prisma.order.update({
                where: { id: order.id },
                data: {
                    status: derived,
                    updatedAt: new Date(),
                    ...tsPatch(derived),
                },
            });
            // Notify push + WS on every status transition.
            this.notifications.notifyManualStatus(order.id, derived);
            this.ws.broadcastOrderUpdate(updated);
            // If the order just became terminal, stop scheduling further push reminders.
            if ((0, order_status_util_1.isTerminal)(derived)) {
                this.notifications.cancelScheduledOrder(order.id);
            }
        }
    }
};
exports.OrderSimulationService = OrderSimulationService;
__decorate([
    (0, schedule_1.Interval)(5_000),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrderSimulationService.prototype, "tick", null);
exports.OrderSimulationService = OrderSimulationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ws_service_1.WsService,
        notifications_service_1.NotificationsService])
], OrderSimulationService);
