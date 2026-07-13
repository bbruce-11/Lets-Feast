import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthRequest } from '../common/decorators/current-user.decorator';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('tokens')
  @HttpCode(204)
  async register(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    const token = typeof body['token'] === 'string' ? body['token'] : '';
    if (!token || !this.pushService.isValidToken(token)) {
      throw new BadRequestException('A valid Expo push token is required');
    }
    const platform = typeof body['platform'] === 'string' ? body['platform'] : null;
    await this.pushService.registerToken(req.user.userId, token, platform);
  }

  @Delete('tokens')
  @HttpCode(204)
  async unregister(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    const token = typeof body['token'] === 'string' ? body['token'] : null;
    if (token) await this.pushService.unregisterToken(req.user.userId, token);
  }
}
