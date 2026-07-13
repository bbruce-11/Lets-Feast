import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function reviewerDisplayName(fullName: string | null): string {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return 'Anonymous';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
}

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.restaurant.findMany({ orderBy: { name: 'asc' } });
  }

  async get(id: string) {
    const row = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Restaurant not found');
    return row;
  }

  getMenu(restaurantId: string) {
    return this.prisma.menuItem.findMany({
      where: { restaurantId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async getReviews(restaurantId: string) {
    const rows = await this.prisma.order.findMany({
      where: {
        restaurantId,
        rating: { not: null },
        ratingComment: { not: null },
      },
      select: {
        id: true,
        rating: true,
        ratingComment: true,
        ratedAt: true,
        user: { select: { fullName: true } },
      },
      orderBy: { ratedAt: 'desc' },
      take: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.ratingComment,
      ratedAt: r.ratedAt,
      reviewerName: reviewerDisplayName(r.user?.fullName ?? null),
    }));
  }
}
