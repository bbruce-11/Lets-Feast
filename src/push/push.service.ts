import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from '../notifications/expo-push.service';

@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPush: ExpoPushService,
  ) {}

  isValidToken(token: string): boolean {
    return this.expoPush.isValidToken(token);
  }

  async registerToken(userId: number, token: string, platform: string | null): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { token, userId, platform, updatedAt: new Date() },
      update: { userId, platform, updatedAt: new Date() },
    });
  }

  async unregisterToken(userId: number, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({
      where: { token, userId },
    });
  }
}
