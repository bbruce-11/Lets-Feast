import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthRequest } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(201)
  async signup(@Body() body: Record<string, unknown>) {
    const fullName = typeof body['fullName'] === 'string' ? body['fullName'].trim() : '';
    const email = typeof body['email'] === 'string' ? body['email'].trim() : '';
    const password = typeof body['password'] === 'string' ? body['password'] : '';
    if (!fullName || !email || !password) {
      throw new BadRequestException('fullName, email, and password are required');
    }
    return this.authService.signup({
      fullName,
      email,
      password,
      phone: typeof body['phone'] === 'string' ? body['phone'] : undefined,
      zipCode: typeof body['zipCode'] === 'string' ? body['zipCode'] : undefined,
      referralCode:
        body['referralCode'] != null ? String(body['referralCode']) : undefined,
    });
  }

  @Post('signin')
  @HttpCode(200)
  async signin(@Body() body: Record<string, unknown>) {
    const email = typeof body['email'] === 'string' ? body['email'].trim() : '';
    const password = typeof body['password'] === 'string' ? body['password'] : '';
    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }
    return this.authService.signin({ email, password });
  }

  @Post('staff/login')
  @HttpCode(200)
  staffLogin(@Body() body: Record<string, unknown>) {
    const passcode = typeof body['passcode'] === 'string' ? body['passcode'] : '';
    if (!passcode) throw new BadRequestException('passcode is required');
    return this.authService.staffLogin(passcode);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: AuthRequest) {
    return this.authService.getMe(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    return this.authService.updateMe(req.user.userId, {
      fullName: typeof body['fullName'] === 'string' ? body['fullName'].trim() : undefined,
      phone: typeof body['phone'] === 'string' ? body['phone'] : undefined,
      zipCode: typeof body['zipCode'] === 'string' ? body['zipCode'] : undefined,
      savedAddresses: body['savedAddresses'],
      preferences: body['preferences'],
    });
  }
}
