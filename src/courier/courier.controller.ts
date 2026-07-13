import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CourierService } from './courier.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator';

@Controller('courier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('driver', 'admin')
export class CourierController {
  constructor(private readonly courierService: CourierService) {}

  /** GET /courier/orders — orders assigned to the requesting driver. */
  @Get('orders')
  getOrders(@CurrentUser() user: JwtPayload) {
    return this.courierService.getDriverOrders(user.userId);
  }

  /** PATCH /courier/orders/:id/status — advance to on_the_way or delivered. */
  @Patch('orders/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) throw new BadRequestException('Invalid order id');
    const status = typeof body['status'] === 'string' ? body['status'] : '';
    if (!status) throw new BadRequestException('status is required');
    return this.courierService.updateDeliveryStatus(orderId, status, user.userId, user.role ?? '');
  }
}
