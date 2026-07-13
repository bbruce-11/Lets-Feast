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
exports.CourierController = void 0;
const common_1 = require("@nestjs/common");
const courier_service_1 = require("./courier.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let CourierController = class CourierController {
    constructor(courierService) {
        this.courierService = courierService;
    }
    /** GET /courier/orders — orders assigned to the requesting driver. */
    getOrders(user) {
        return this.courierService.getDriverOrders(user.userId);
    }
    /** PATCH /courier/orders/:id/status — advance to on_the_way or delivered. */
    updateStatus(id, body, user) {
        const orderId = parseInt(id, 10);
        if (Number.isNaN(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        const status = typeof body['status'] === 'string' ? body['status'] : '';
        if (!status)
            throw new common_1.BadRequestException('status is required');
        return this.courierService.updateDeliveryStatus(orderId, status, user.userId, user.role ?? '');
    }
};
exports.CourierController = CourierController;
__decorate([
    (0, common_1.Get)('orders'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CourierController.prototype, "getOrders", null);
__decorate([
    (0, common_1.Patch)('orders/:id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], CourierController.prototype, "updateStatus", null);
exports.CourierController = CourierController = __decorate([
    (0, common_1.Controller)('courier'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('driver', 'admin'),
    __metadata("design:paramtypes", [courier_service_1.CourierService])
], CourierController);
