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
exports.NotificationsService = exports.MAX_CATCHUP_AGE_MS = exports.ACTIVE_WINDOW_MS = void 0;
exports.shouldPush = shouldPush;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const expo_push_service_1 = require("./expo-push.service");
const order_status_util_1 = require("../common/order-status.util");
const NOTIFY_STATUSES = ['preparing', 'driver_assigned', 'on_the_way', 'delivered'];
const COPY = {
    preparing: {
        title: '👨‍🍳 Your order is being prepared',
        body: 'The kitchen has started cooking up your feast.',
    },
    driver_assigned: {
        title: '🚗 Driver assigned',
        body: 'Your driver is heading to the restaurant to pick up your order.',
    },
    on_the_way: {
        title: '🍽️ Your feast is on the way',
        body: 'Your order has been picked up and is heading to you.',
    },
    delivered: {
        title: '🎉 Delivered!',
        body: 'Your feast has arrived. Enjoy!',
    },
};
exports.ACTIVE_WINDOW_MS = 12_000;
exports.MAX_CATCHUP_AGE_MS = 5 * 60_000;
function statusIndex(status) {
    if (!status)
        return -1;
    return NOTIFY_STATUSES.indexOf(status);
}
function toMs(value) {
    if (!value)
        return null;
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
}
function shouldPush(activationMs, now, lastPolledMs) {
    if (now - activationMs > exports.MAX_CATCHUP_AGE_MS)
        return false;
    if (lastPolledMs != null && now - lastPolledMs <= exports.ACTIVE_WINDOW_MS)
        return false;
    if (lastPolledMs != null && activationMs <= lastPolledMs)
        return false;
    return true;
}
let NotificationsService = class NotificationsService {
    constructor(prisma, push) {
        this.prisma = prisma;
        this.push = push;
        this.timers = new Map();
        this.handling = new Set();
    }
    async onModuleInit() {
        await this.scheduleOrderNotifications();
        setInterval(() => {
            this.scheduleOrderNotifications().catch(() => { });
        }, 60_000);
    }
    /** Scans all pending-notification orders and (re)schedules timers for each. */
    async scheduleOrderNotifications() {
        const rows = await this.prisma.order
            .findMany({
            where: {
                status: { not: 'cancelled' },
                OR: [{ notifiedStatus: null }, { notifiedStatus: { not: 'delivered' } }],
            },
            select: { id: true },
        })
            .catch(() => []);
        for (const row of rows)
            this.scheduleOrderById(row.id);
    }
    /** Called right after order creation so notifications are scheduled immediately. */
    scheduleOrderById(orderId) {
        void this.scheduleOrder(orderId).catch(() => { });
    }
    /** Sends the customer push for a manually-set status; reuses the same dedup rules. */
    notifyManualStatus(orderId, status) {
        void this.notifyManualStatusInner(orderId, status).catch(() => { });
    }
    /** Cancel any pending timers for an order that has reached a terminal status. */
    cancelScheduledOrder(orderId) {
        this.clearTimer(orderId);
        this.handling.delete(orderId);
    }
    clearTimer(orderId) {
        const h = this.timers.get(orderId);
        if (h) {
            clearTimeout(h);
            this.timers.delete(orderId);
        }
    }
    async scheduleOrder(orderId) {
        if (this.handling.has(orderId))
            return;
        this.handling.add(orderId);
        try {
            let order = await this.fetchOrder(orderId);
            if (!order || order.status === 'cancelled' || order.statusManual) {
                this.clearTimer(orderId);
                return;
            }
            const createdMs = toMs(order.createdAt);
            if (!createdMs) {
                this.clearTimer(orderId);
                return;
            }
            for (let i = statusIndex(order.notifiedStatus) + 1; i < NOTIFY_STATUSES.length; i++) {
                const status = NOTIFY_STATUSES[i];
                const activationMs = createdMs + order_status_util_1.OFFSETS_MS[status];
                const now = Date.now();
                const delay = activationMs - now;
                if (delay > 0) {
                    this.clearTimer(orderId);
                    const h = setTimeout(() => {
                        this.timers.delete(orderId);
                        void this.scheduleOrder(orderId).catch(() => { });
                    }, delay);
                    this.timers.set(orderId, h);
                    return;
                }
                const lastPolledMs = toMs(order.lastPolledAt);
                if (shouldPush(activationMs, now, lastPolledMs)) {
                    const copy = COPY[status];
                    await this.push.sendToUser(order.userId, {
                        title: copy.title,
                        body: copy.body,
                        data: { type: 'order_status', orderId: order.id, status },
                    });
                }
                await this.prisma.order.update({
                    where: { id: order.id },
                    data: { notifiedStatus: status, updatedAt: new Date() },
                });
                order = { ...order, notifiedStatus: status };
            }
            this.clearTimer(orderId);
        }
        finally {
            this.handling.delete(orderId);
        }
    }
    async notifyManualStatusInner(orderId, status) {
        if (this.handling.has(orderId))
            return;
        this.handling.add(orderId);
        try {
            const order = await this.fetchOrder(orderId);
            if (!order)
                return;
            this.clearTimer(orderId);
            const idx = statusIndex(status);
            if (idx < 0 || idx <= statusIndex(order.notifiedStatus))
                return;
            const now = Date.now();
            const lastPolledMs = toMs(order.lastPolledAt);
            if (shouldPush(now, now, lastPolledMs)) {
                const copy = COPY[status];
                if (copy) {
                    await this.push.sendToUser(order.userId, {
                        title: copy.title,
                        body: copy.body,
                        data: { type: 'order_status', orderId: order.id, status },
                    });
                }
            }
            await this.prisma.order.update({
                where: { id: order.id },
                data: { notifiedStatus: status, updatedAt: new Date() },
            });
        }
        finally {
            this.handling.delete(orderId);
        }
    }
    fetchOrder(orderId) {
        return this.prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                userId: true,
                createdAt: true,
                status: true,
                statusManual: true,
                notifiedStatus: true,
                lastPolledAt: true,
            },
        });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        expo_push_service_1.ExpoPushService])
], NotificationsService);
