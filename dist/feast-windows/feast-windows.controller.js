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
exports.FeastWindowsController = void 0;
const common_1 = require("@nestjs/common");
const feast_windows_service_1 = require("./feast-windows.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
let FeastWindowsController = class FeastWindowsController {
    constructor(fwService) {
        this.fwService = fwService;
    }
    list() {
        return this.fwService.list();
    }
    getJoined(req) {
        return this.fwService.getJoined(req.user.userId);
    }
    get(id) {
        return this.fwService.get(id);
    }
    join(id, req) {
        return this.fwService.join(id, req.user.userId);
    }
};
exports.FeastWindowsController = FeastWindowsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FeastWindowsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('me/joined'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FeastWindowsController.prototype, "getJoined", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FeastWindowsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(':id/join'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FeastWindowsController.prototype, "join", null);
exports.FeastWindowsController = FeastWindowsController = __decorate([
    (0, common_1.Controller)('feast-windows'),
    __metadata("design:paramtypes", [feast_windows_service_1.FeastWindowsService])
], FeastWindowsController);
