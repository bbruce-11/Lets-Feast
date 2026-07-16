import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService, CreateMenuItemInput, CreateRestaurantInput } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  @Get('restaurants')
  async listRestaurants() {
    const rows = await this.prisma.restaurant.findMany({ orderBy: { name: 'asc' } });
    return rows.map((r) => ({
      ...r,
      // Prisma returns Decimal as a string-like object; cast to JS number so
      // the JSON payload matches the declared `rating: number | null` contract.
      rating: r.rating != null ? Number(r.rating) : null,
    }));
  }

  @Post('restaurants')
  createRestaurant(@Body() body: CreateRestaurantInput) {
    return this.adminService.createRestaurant(body);
  }

  @Post('restaurants/:id/menu-items')
  addMenuItems(@Param('id') id: string, @Body() body: { items: CreateMenuItemInput[] }) {
    return this.adminService.addMenuItems(id, body.items ?? []);
  }

  @Patch('restaurants/:id/commission-rate')
  setCommissionRate(@Param('id') id: string, @Body() body: { commissionRatePercent: number }) {
    return this.adminService.setCommissionRate(id, body.commissionRatePercent);
  }

  @Get('restaurants/:id/commission-history')
  getCommissionHistory(@Param('id') id: string) {
    return this.adminService.getCommissionHistory(id);
  }
}
