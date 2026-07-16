import { Global, Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { StripeService } from './stripe.service';
import { CommissionService } from './commission.service';

@Global()
@Module({
  providers: [PricingService, StripeService, CommissionService],
  exports: [PricingService, StripeService, CommissionService],
})
export class SharedModule {}
