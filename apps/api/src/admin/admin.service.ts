import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommissionService } from '../shared/commission.service';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export interface CreateMenuItemInput {
  category: string;
  name: string;
  description?: string;
  price: number;
  allergyTags?: string[];
  dietaryTags?: string[];
}

export interface UpdateMenuItemInput {
  category?: string;
  name?: string;
  description?: string;
  price?: number;
}

export interface CreateRestaurantInput {
  name: string;
  cuisine: string;
  neighborhood: string;
  /** Platform commission rate as a percentage, e.g. 15 for 15%. */
  commissionRatePercent: number;
  menuItems?: CreateMenuItemInput[];
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commission: CommissionService,
  ) {}

  private async generateRestaurantId(name: string): Promise<string> {
    const base = slugify(name) || 'restaurant';
    let candidate = base;
    let suffix = 1;
    // Small pilot dataset - a simple existence-check loop is plenty here.
    while (await this.prisma.restaurant.findUnique({ where: { id: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  async createRestaurant(input: CreateRestaurantInput) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    if (!input.cuisine?.trim()) throw new BadRequestException('cuisine is required');
    if (!input.neighborhood?.trim()) throw new BadRequestException('neighborhood is required');
    if (
      typeof input.commissionRatePercent !== 'number' ||
      input.commissionRatePercent < 0 ||
      input.commissionRatePercent > 100
    ) {
      throw new BadRequestException('commissionRatePercent must be a number between 0 and 100');
    }
    const platformFeeBps = Math.round(input.commissionRatePercent * 100);

    const id = await this.generateRestaurantId(input.name);

    const restaurant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          id,
          name: input.name.trim(),
          cuisine: input.cuisine.trim(),
          neighborhood: input.neighborhood.trim(),
        },
      });
      await tx.commissionRule.create({
        data: { restaurantId: id, platformFeeBps, startsAt: new Date() },
      });
      if (input.menuItems?.length) {
        await tx.menuItem.createMany({
          data: input.menuItems.map((item, i) => ({
            id: `${id}-m${i + 1}`,
            restaurantId: id,
            category: item.category,
            name: item.name,
            description: item.description ?? '',
            price: item.price.toFixed(2),
            allergyTags: item.allergyTags ?? [],
            dietaryTags: item.dietaryTags ?? [],
          })),
        });
      }
      return created;
    });

    return restaurant;
  }

  async addMenuItems(restaurantId: string, items: CreateMenuItemInput[]) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new BadRequestException('Restaurant not found');
    if (!items?.length) throw new BadRequestException('At least one menu item is required');

    const existingCount = await this.prisma.menuItem.count({ where: { restaurantId } });
    await this.prisma.menuItem.createMany({
      data: items.map((item, i) => ({
        id: `${restaurantId}-m${existingCount + i + 1}`,
        restaurantId,
        category: item.category,
        name: item.name,
        description: item.description ?? '',
        price: item.price.toFixed(2),
        allergyTags: item.allergyTags ?? [],
        dietaryTags: item.dietaryTags ?? [],
      })),
    });
    return this.prisma.menuItem.findMany({ where: { restaurantId }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  async updateMenuItem(restaurantId: string, menuItemId: string, input: UpdateMenuItemInput) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!existing || existing.restaurantId !== restaurantId) {
      throw new BadRequestException('Menu item not found for this restaurant');
    }
    if (input.price != null && (!Number.isFinite(input.price) || input.price < 0)) {
      throw new BadRequestException('Price must be a non-negative number');
    }

    return this.prisma.menuItem.update({
      where: { id: menuItemId },
      data: {
        ...(input.category != null && { category: input.category }),
        ...(input.name != null && { name: input.name }),
        ...(input.description != null && { description: input.description }),
        ...(input.price != null && { price: input.price.toFixed(2) }),
      },
    });
  }

  async deleteMenuItem(restaurantId: string, menuItemId: string) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!existing || existing.restaurantId !== restaurantId) {
      throw new BadRequestException('Menu item not found for this restaurant');
    }
    try {
      await this.prisma.menuItem.delete({ where: { id: menuItemId } });
    } catch {
      // Foreign key constraint - this item appears on at least one past order.
      // Order history keeps a frozen copy of name/price, so the order itself
      // is unaffected either way; we just can't remove the row it points to.
      throw new BadRequestException(
        'This item has already been ordered at least once and can\'t be deleted. Edit it instead, or ask engineering about archiving items.',
      );
    }
    return { deleted: true };
  }

  async setCommissionRate(restaurantId: string, commissionRatePercent: number) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) throw new BadRequestException('Restaurant not found');
    if (commissionRatePercent < 0 || commissionRatePercent > 100)
      throw new BadRequestException('commissionRatePercent must be between 0 and 100');
    return this.commission.setRate(restaurantId, Math.round(commissionRatePercent * 100));
  }

  getCommissionHistory(restaurantId: string) {
    return this.commission.listHistory(restaurantId);
  }
}
