import { Global, Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { StripeService } from './stripe.service';

@Global()
@Module({
  providers: [PricingService, StripeService],
  exports: [PricingService, StripeService],
})
export class SharedModule {}
