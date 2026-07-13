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
exports.PushService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const expo_push_service_1 = require("../notifications/expo-push.service");
let PushService = class PushService {
    constructor(prisma, expoPush) {
        this.prisma = prisma;
        this.expoPush = expoPush;
    }
    isValidToken(token) {
        return this.expoPush.isValidToken(token);
    }
    async registerToken(userId, token, platform) {
        await this.prisma.pushToken.upsert({
            where: { token },
            create: { token, userId, platform, updatedAt: new Date() },
            update: { userId, platform, updatedAt: new Date() },
        });
    }
    async unregisterToken(userId, token) {
        await this.prisma.pushToken.deleteMany({
            where: { token, userId },
        });
    }
};
exports.PushService = PushService;
exports.PushService = PushService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        expo_push_service_1.ExpoPushService])
], PushService);
