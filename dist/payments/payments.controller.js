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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const payments_service_1 = require("./payments.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
let PaymentsController = class PaymentsController {
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
    }
    createIntent(req, body) {
        const restaurantId = typeof body['restaurantId'] === 'string' ? body['restaurantId'] : '';
        if (!restaurantId)
            throw new common_1.BadRequestException('restaurantId is required');
        return this.paymentsService.createIntent(req.user.userId, {
            restaurantId,
            feastWindowId: body['feastWindowId'] != null ? String(body['feastWindowId']) : null,
            deliveryType: typeof body['deliveryType'] === 'string' ? body['deliveryType'] : 'delivery',
            items: Array.isArray(body['items']) ? body['items'] : [],
        });
    }
    confirmPayment(req, body) {
        const paymentIntentId = typeof body['paymentIntentId'] === 'string' ? body['paymentIntentId'] : '';
        const paymentMethod = typeof body['paymentMethod'] === 'string' ? body['paymentMethod'] : '';
        if (!paymentIntentId || !paymentMethod)
            throw new common_1.BadRequestException('paymentIntentId and paymentMethod are required');
        return this.paymentsService.confirmPayment(req.user.userId, {
            paymentIntentId,
            paymentMethod,
            savePaymentMethod: body['savePaymentMethod'] === true,
        });
    }
    listMethods(req) {
        return this.paymentsService.listMethods(req.user.userId);
    }
    attachMethod(req, body) {
        const paymentMethod = typeof body['paymentMethod'] === 'string' ? body['paymentMethod'] : '';
        if (!paymentMethod)
            throw new common_1.BadRequestException('paymentMethod is required');
        return this.paymentsService.attachMethod(req.user.userId, paymentMethod);
    }
    setDefault(req, id) {
        return this.paymentsService.setDefaultMethod(req.user.userId, id);
    }
    deleteMethod(req, id) {
        return this.paymentsService.deleteMethod(req.user.userId, id);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)('create-intent'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "createIntent", null);
__decorate([
    (0, common_1.Post)('confirm'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "confirmPayment", null);
__decorate([
    (0, common_1.Get)('methods'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "listMethods", null);
__decorate([
    (0, common_1.Post)('methods'),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "attachMethod", null);
__decorate([
    (0, common_1.Post)('methods/:id/default'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "setDefault", null);
__decorate([
    (0, common_1.Delete)('methods/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "deleteMethod", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, common_1.Controller)('payments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
