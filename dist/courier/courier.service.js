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
exports.CourierService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ws_service_1 = require("../ws/ws.service");
let CourierService = class CourierService {
    constructor(prisma, ws) {
        this.prisma = prisma;
        this.ws = ws;
    }
    /** Returns orders in driver_assigned or on_the_way that belong to this driver. */
    async getDriverOrders(userId) {
        const rows = await this.prisma.order.findMany({
            where: {
                status: { in: ['driver_assigned', 'on_the_way'] },
                driverId: userId,
            },
            include: {
                restaurant: { select: { name: true } },
                user: { select: { fullName: true, phone: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        return rows.map((r) => ({
            ...r,
            subtotal: r.subtotal.toString(),
            restaurantName: r.restaurant?.name ?? null,
            customerName: r.user?.fullName ?? null,
            customerPhone: r.user?.phone ?? null,
            restaurant: undefined,
            user: undefined,
        }));
    }
    /** Advances a delivery order to on_the_way or delivered. Drivers may only update their own orders. */
    async updateDeliveryStatus(orderId, status, userId, userRole) {
        const allowed = ['on_the_way', 'delivered'];
        if (!allowed.includes(status)) {
            throw new common_1.ForbiddenException(`Couriers may only set status to: ${allowed.join(', ')}`);
        }
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        // Drivers may only update orders explicitly assigned to them; admins bypass.
        if (userRole !== 'admin' && order.driverId !== userId) {
            throw new common_1.ForbiddenException('You are not assigned to this order');
        }
        const prev = order.status;
        if (prev === status)
            return order;
        const now = new Date();
        const tsPatch = {};
        if (status === 'on_the_way')
            tsPatch['onTheWayAt'] = now;
        if (status === 'delivered')
            tsPatch['deliveredAt'] = now;
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { status, statusManual: true, ...tsPatch },
            include: {
                restaurant: { select: { name: true } },
                user: { select: { fullName: true, phone: true } },
            },
        });
        this.ws.broadcast({ type: 'order_update', order: { ...updated, subtotal: updated.subtotal.toString() } });
        return {
            ...updated,
            subtotal: updated.subtotal.toString(),
            restaurantName: updated.restaurant?.name ?? null,
            customerName: updated.user?.fullName ?? null,
            customerPhone: updated.user?.phone ?? null,
            restaurant: undefined,
            user: undefined,
        };
    }
};
exports.CourierService = CourierService;
exports.CourierService = CourierService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ws_service_1.WsService])
], CourierService);
