import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

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
}
