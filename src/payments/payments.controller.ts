import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthRequest } from '../common/decorators/current-user.decorator';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  createIntent(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    const restaurantId = typeof body['restaurantId'] === 'string' ? body['restaurantId'] : '';
    if (!restaurantId) throw new BadRequestException('restaurantId is required');
    return this.paymentsService.createIntent(req.user.userId, {
      restaurantId,
      feastWindowId: body['feastWindowId'] != null ? String(body['feastWindowId']) : null,
      deliveryType: typeof body['deliveryType'] === 'string' ? body['deliveryType'] : 'delivery',
      items: Array.isArray(body['items']) ? body['items'] : [],
    });
  }

  @Post('confirm')
  confirmPayment(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    const paymentIntentId = typeof body['paymentIntentId'] === 'string' ? body['paymentIntentId'] : '';
    const paymentMethod = typeof body['paymentMethod'] === 'string' ? body['paymentMethod'] : '';
    if (!paymentIntentId || !paymentMethod)
      throw new BadRequestException('paymentIntentId and paymentMethod are required');
    return this.paymentsService.confirmPayment(req.user.userId, {
      paymentIntentId,
      paymentMethod,
      savePaymentMethod: body['savePaymentMethod'] === true,
    });
  }

  @Get('methods')
  listMethods(@Req() req: AuthRequest) {
    return this.paymentsService.listMethods(req.user.userId);
  }

  @Post('methods')
  @HttpCode(201)
  attachMethod(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    const paymentMethod = typeof body['paymentMethod'] === 'string' ? body['paymentMethod'] : '';
    if (!paymentMethod) throw new BadRequestException('paymentMethod is required');
    return this.paymentsService.attachMethod(req.user.userId, paymentMethod);
  }

  @Post('methods/:id/default')
  setDefault(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.paymentsService.setDefaultMethod(req.user.userId, id);
  }

  @Delete('methods/:id')
  deleteMethod(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.paymentsService.deleteMethod(req.user.userId, id);
  }
}
