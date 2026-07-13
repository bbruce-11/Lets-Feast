import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthRequest } from '../common/decorators/current-user.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(201)
  placeOrder(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    return this.ordersService.placeOrder(req.user.userId, {
      restaurantId: typeof body['restaurantId'] === 'string' ? body['restaurantId'] : '',
      feastWindowId: body['feastWindowId'] != null ? String(body['feastWindowId']) : null,
      deliveryType: typeof body['deliveryType'] === 'string' ? body['deliveryType'] : 'delivery',
      deliveryAddress:
        typeof body['deliveryAddress'] === 'string' ? body['deliveryAddress'] : null,
      deliveryLat: typeof body['deliveryLat'] === 'number' ? body['deliveryLat'] : null,
      deliveryLng: typeof body['deliveryLng'] === 'number' ? body['deliveryLng'] : null,
      items: Array.isArray(body['items']) ? body['items'] : [],
      paymentIntentId:
        typeof body['paymentIntentId'] === 'string' ? body['paymentIntentId'] : '',
    });
  }

  @Get('me')
  getMyOrders(@Req() req: AuthRequest) {
    return this.ordersService.getMyOrders(req.user.userId);
  }

  /** Staff view — all non-terminal orders across all restaurants. */
  @Get('active')
  @UseGuards(RolesGuard)
  @Roles('restaurant_staff')
  getActiveOrders() {
    return this.ordersService.getActiveOrders();
  }

  @Get(':id')
  getOrder(@Req() req: AuthRequest, @Param('id') id: string) {
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) throw new BadRequestException('Invalid order id');
    return this.ordersService.getOrder(orderId, req.user.userId);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('restaurant_staff', 'driver', 'admin')
  updateStatus(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) throw new BadRequestException('Invalid order id');
    const status = typeof body['status'] === 'string' ? body['status'] : '';
    if (!status) throw new BadRequestException('status is required');
    return this.ordersService.updateStatus(orderId, status);
  }

  @Post(':id/advance')
  @UseGuards(RolesGuard)
  @Roles('restaurant_staff', 'driver', 'admin')
  advanceOrder(@Param('id') id: string) {
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) throw new BadRequestException('Invalid order id');
    return this.ordersService.advanceOrder(orderId);
  }

  @Post(':id/rating')
  async rateOrder(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) throw new BadRequestException('Invalid order id');
    const rating = typeof body['rating'] === 'number' ? body['rating'] : NaN;
    const comment = body['comment'] != null ? String(body['comment']) : null;
    const { order, isEdit } = await this.ordersService.rateOrder(orderId, req.user.userId, rating, comment);
    // Match Express: 200 for an edited rating, 201 for a new one.
    res.status(isEdit ? 200 : 201);
    return order;
  }
}
