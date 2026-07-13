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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
let OrdersController = class OrdersController {
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    placeOrder(req, body) {
        return this.ordersService.placeOrder(req.user.userId, {
            restaurantId: typeof body['restaurantId'] === 'string' ? body['restaurantId'] : '',
            feastWindowId: body['feastWindowId'] != null ? String(body['feastWindowId']) : null,
            deliveryType: typeof body['deliveryType'] === 'string' ? body['deliveryType'] : 'delivery',
            deliveryAddress: typeof body['deliveryAddress'] === 'string' ? body['deliveryAddress'] : null,
            deliveryLat: typeof body['deliveryLat'] === 'number' ? body['deliveryLat'] : null,
            deliveryLng: typeof body['deliveryLng'] === 'number' ? body['deliveryLng'] : null,
            items: Array.isArray(body['items']) ? body['items'] : [],
            paymentIntentId: typeof body['paymentIntentId'] === 'string' ? body['paymentIntentId'] : '',
        });
    }
    getMyOrders(req) {
        return this.ordersService.getMyOrders(req.user.userId);
    }
    /** Staff view — all non-terminal orders across all restaurants. */
    getActiveOrders() {
        return this.ordersService.getActiveOrders();
    }
    getOrder(req, id) {
        const orderId = parseInt(id, 10);
        if (Number.isNaN(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        return this.ordersService.getOrder(orderId, req.user.userId);
    }
    updateStatus(id, body) {
        const orderId = parseInt(id, 10);
        if (Number.isNaN(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        const status = typeof body['status'] === 'string' ? body['status'] : '';
        if (!status)
            throw new common_1.BadRequestException('status is required');
        return this.ordersService.updateStatus(orderId, status);
    }
    advanceOrder(id) {
        const orderId = parseInt(id, 10);
        if (Number.isNaN(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        return this.ordersService.advanceOrder(orderId);
    }
    async rateOrder(req, id, body, res) {
        const orderId = parseInt(id, 10);
        if (Number.isNaN(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        const rating = typeof body['rating'] === 'number' ? body['rating'] : NaN;
        const comment = body['comment'] != null ? String(body['comment']) : null;
        const { order, isEdit } = await this.ordersService.rateOrder(orderId, req.user.userId, rating, comment);
        // Match Express: 200 for an edited rating, 201 for a new one.
        res.status(isEdit ? 200 : 201);
        return order;
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "placeOrder", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "getMyOrders", null);
__decorate([
    (0, common_1.Get)('active'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('restaurant_staff'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "getActiveOrders", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "getOrder", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('restaurant_staff', 'driver', 'admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Post)(':id/advance'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('restaurant_staff', 'driver', 'admin'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "advanceOrder", null);
__decorate([
    (0, common_1.Post)(':id/rating'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "rateOrder", null);
exports.OrdersController = OrdersController = __decorate([
    (0, common_1.Controller)('orders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
