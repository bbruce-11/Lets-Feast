import { Controller, Get, Param } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Get()
  list() {
    return this.restaurantsService.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.restaurantsService.get(id);
  }

  @Get(':id/menu')
  getMenu(@Param('id') id: string) {
    return this.restaurantsService.getMenu(id);
  }

  @Get(':id/reviews')
  getReviews(@Param('id') id: string) {
    return this.restaurantsService.getReviews(id);
  }
}
