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
exports.PricingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const DELIVERY_FEE_CENTS = 299;
const SERVICE_FEE_RATE = 0.05;
let PricingService = class PricingService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Single source of truth for cart pricing. Uses DB prices — never trusts client values. */
    async priceOrder(input) {
        const { restaurantId, deliveryType } = input;
        if (!input.items.length)
            return { ok: false, status: 400, error: 'Order must contain at least one item' };
        const ids = [...new Set(input.items.map((r) => r.menuItemId))];
        const menuRows = await this.prisma.menuItem.findMany({
            where: { restaurantId, id: { in: ids } },
            select: { id: true, name: true, price: true },
        });
        const menuById = new Map(menuRows.map((m) => [m.id, m]));
        const missing = ids.filter((id) => !menuById.has(id));
        if (missing.length > 0)
            return { ok: false, status: 400, error: `Unknown menu item(s) for this restaurant: ${missing.join(', ')}` };
        let subtotalCents = 0;
        const lineItems = input.items.map((r) => {
            const menu = menuById.get(r.menuItemId);
            const unitPrice = Number(menu.price);
            subtotalCents += Math.round(unitPrice * 100) * r.quantity;
            return {
                menuItemId: r.menuItemId,
                name: menu.name,
                price: unitPrice,
                quantity: r.quantity,
                ...(r.specialInstructions ? { specialInstructions: r.specialInstructions } : {}),
            };
        });
        const deliveryFeeCents = deliveryType === 'delivery' ? DELIVERY_FEE_CENTS : 0;
        const serviceFeeCents = Math.round(subtotalCents * SERVICE_FEE_RATE);
        let discountCents = 0;
        if (input.feastWindowId) {
            const win = await this.prisma.feastWindow.findUnique({
                where: { id: input.feastWindowId },
                select: { discount: true },
            });
            if (win?.discount != null)
                discountCents = Math.round(Number(win.discount) * 100);
        }
        const totalCents = Math.max(0, subtotalCents + deliveryFeeCents + serviceFeeCents - discountCents);
        return {
            ok: true,
            priced: { lineItems, subtotalCents, deliveryFeeCents, serviceFeeCents, discountCents, totalCents },
        };
    }
    /** Normalises the loosely-typed client items array — drops price/name, returns only trusted fields. */
    normalizeRequestedItems(items) {
        const out = [];
        for (const raw of items) {
            const it = raw;
            const menuItemId = typeof it.menuItemId === 'string' ? it.menuItemId : '';
            const quantity = Number(it.quantity);
            if (!menuItemId || !Number.isInteger(quantity) || quantity <= 0)
                return { ok: false, error: 'Each item needs a valid menuItemId and a positive integer quantity' };
            const specialInstructions = typeof it.specialInstructions === 'string' && it.specialInstructions.trim()
                ? it.specialInstructions.trim()
                : null;
            out.push({ menuItemId, quantity, specialInstructions });
        }
        return { ok: true, items: out };
    }
};
exports.PricingService = PricingService;
exports.PricingService = PricingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PricingService);
