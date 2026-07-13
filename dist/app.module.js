"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const schedule_1 = require("@nestjs/schedule");
const prisma_module_1 = require("./prisma/prisma.module");
const ws_module_1 = require("./ws/ws.module");
const shared_module_1 = require("./shared/shared.module");
const auth_module_1 = require("./auth/auth.module");
const health_module_1 = require("./health/health.module");
const restaurants_module_1 = require("./restaurants/restaurants.module");
const feast_windows_module_1 = require("./feast-windows/feast-windows.module");
const push_module_1 = require("./push/push.module");
const orders_module_1 = require("./orders/orders.module");
const payments_module_1 = require("./payments/payments.module");
const notifications_module_1 = require("./notifications/notifications.module");
const courier_module_1 = require("./courier/courier.module");
const admin_module_1 = require("./admin/admin.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // JwtModule registered globally so JwtService is injectable in all modules
            // (required by JwtAuthGuard which is used across many controllers).
            // In production, JWT_SECRET must be set explicitly — no insecure default.
            jwt_1.JwtModule.registerAsync({
                global: true,
                useFactory: () => {
                    const secret = process.env['JWT_SECRET'];
                    if (!secret && process.env['NODE_ENV'] === 'production') {
                        throw new Error('JWT_SECRET environment variable is required in production');
                    }
                    return {
                        secret: secret ?? 'feast-dev-secret-change-in-production',
                        signOptions: { expiresIn: '30d' },
                    };
                },
            }),
            schedule_1.ScheduleModule.forRoot(),
            prisma_module_1.PrismaModule,
            ws_module_1.WsModule,
            shared_module_1.SharedModule,
            notifications_module_1.NotificationsModule,
            health_module_1.HealthModule,
            auth_module_1.AuthModule,
            restaurants_module_1.RestaurantsModule,
            feast_windows_module_1.FeastWindowsModule,
            push_module_1.PushModule,
            orders_module_1.OrdersModule,
            payments_module_1.PaymentsModule,
            courier_module_1.CourierModule,
            admin_module_1.AdminModule,
        ],
    })
], AppModule);
