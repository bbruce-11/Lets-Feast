import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { WsModule } from './ws/ws.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { FeastWindowsModule } from './feast-windows/feast-windows.module';
import { PushModule } from './push/push.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CourierModule } from './courier/courier.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // JwtModule registered globally so JwtService is injectable in all modules
    // (required by JwtAuthGuard which is used across many controllers).
    // In production, JWT_SECRET must be set explicitly — no insecure default.
    JwtModule.registerAsync({
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
    ScheduleModule.forRoot(),
    PrismaModule,
    WsModule,
    SharedModule,
    NotificationsModule,
    HealthModule,
    AuthModule,
    RestaurantsModule,
    FeastWindowsModule,
    PushModule,
    OrdersModule,
    PaymentsModule,
    CourierModule,
    AdminModule,
  ],
})
export class AppModule {}
