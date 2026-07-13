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
exports.RestaurantsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
function reviewerDisplayName(fullName) {
    const trimmed = (fullName ?? '').trim();
    if (!trimmed)
        return 'Anonymous';
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1)
        return parts[0];
    const last = parts[parts.length - 1];
    return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
}
let RestaurantsService = class RestaurantsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    list() {
        return this.prisma.restaurant.findMany({ orderBy: { name: 'asc' } });
    }
    async get(id) {
        const row = await this.prisma.restaurant.findUnique({ where: { id } });
        if (!row)
            throw new common_1.NotFoundException('Restaurant not found');
        return row;
    }
    getMenu(restaurantId) {
        return this.prisma.menuItem.findMany({
            where: { restaurantId },
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });
    }
    async getReviews(restaurantId) {
        const rows = await this.prisma.order.findMany({
            where: {
                restaurantId,
                rating: { not: null },
                ratingComment: { not: null },
            },
            select: {
                id: true,
                rating: true,
                ratingComment: true,
                ratedAt: true,
                user: { select: { fullName: true } },
            },
            orderBy: { ratedAt: 'desc' },
            take: 50,
        });
        return rows.map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.ratingComment,
            ratedAt: r.ratedAt,
            reviewerName: reviewerDisplayName(r.user?.fullName ?? null),
        }));
    }
};
exports.RestaurantsService = RestaurantsService;
exports.RestaurantsService = RestaurantsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RestaurantsService);
