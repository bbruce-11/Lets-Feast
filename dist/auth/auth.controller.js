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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    async signup(body) {
        const fullName = typeof body['fullName'] === 'string' ? body['fullName'].trim() : '';
        const email = typeof body['email'] === 'string' ? body['email'].trim() : '';
        const password = typeof body['password'] === 'string' ? body['password'] : '';
        if (!fullName || !email || !password) {
            throw new common_1.BadRequestException('fullName, email, and password are required');
        }
        return this.authService.signup({
            fullName,
            email,
            password,
            phone: typeof body['phone'] === 'string' ? body['phone'] : undefined,
            zipCode: typeof body['zipCode'] === 'string' ? body['zipCode'] : undefined,
            referralCode: body['referralCode'] != null ? String(body['referralCode']) : undefined,
        });
    }
    async signin(body) {
        const email = typeof body['email'] === 'string' ? body['email'].trim() : '';
        const password = typeof body['password'] === 'string' ? body['password'] : '';
        if (!email || !password) {
            throw new common_1.BadRequestException('email and password are required');
        }
        return this.authService.signin({ email, password });
    }
    staffLogin(body) {
        const passcode = typeof body['passcode'] === 'string' ? body['passcode'] : '';
        if (!passcode)
            throw new common_1.BadRequestException('passcode is required');
        return this.authService.staffLogin(passcode);
    }
    getMe(req) {
        return this.authService.getMe(req.user.userId);
    }
    updateMe(req, body) {
        return this.authService.updateMe(req.user.userId, {
            fullName: typeof body['fullName'] === 'string' ? body['fullName'].trim() : undefined,
            phone: typeof body['phone'] === 'string' ? body['phone'] : undefined,
            zipCode: typeof body['zipCode'] === 'string' ? body['zipCode'] : undefined,
            savedAddresses: body['savedAddresses'],
            preferences: body['preferences'],
        });
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('signup'),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signup", null);
__decorate([
    (0, common_1.Post)('signin'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signin", null);
__decorate([
    (0, common_1.Post)('staff/login'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "staffLogin", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "getMe", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "updateMe", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
