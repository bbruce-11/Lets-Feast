import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Flat courier base fee per delivery order, in cents. Courier payout is this
 * base fee plus 100% of whatever tip the customer enters — no platform cut
 * on tips. This is a business parameter, not a technical constant; adjust
 * here if the pilot rate changes.
 */
export const COURIER_BASE_FEE_CENTS = 500; // $5.00

export interface CommissionBreakdown {
  commissionRuleId: string;
  platformFeeCents: number;
  restaurantPayoutCents: number;
  /** Null for pickup orders — no courier involved. */
  courierFeeCents: number | null;
}

@Injectable()
export class CommissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds the CommissionRule in effect for a restaurant at a given moment.
   * Throws rather than silently defaulting — a restaurant with no active
   * rule is a configuration bug (it would otherwise take 0% commission
   * without anyone noticing), not a case to paper over.
   */
  async getActiveRule(restaurantId: string, at: Date = new Date()) {
    const rule = await this.prisma.commissionRule.findFirst({
      where: {
        restaurantId,
        startsAt: { lte: at },
        OR: [{ endsAt: null }, { endsAt: { gt: at } }],
      },
      orderBy: { startsAt: 'desc' },
    });
    if (!rule) {
      throw new InternalServerErrorException(
        `No active commission rule configured for restaurant ${restaurantId}`,
      );
    }
    return rule;
  }

  /** Computes the immutable fee snapshot for an order at placement time. */
  async computeFees(input: {
    restaurantId: string;
    subtotalCents: number;
    tipCents: number;
    deliveryType: 'delivery' | 'pickup';
  }): Promise<CommissionBreakdown> {
    const rule = await this.getActiveRule(input.restaurantId);
    const platformFeeCents = Math.round((input.subtotalCents * rule.platformFeeBps) / 10_000);
    const restaurantPayoutCents = input.subtotalCents - platformFeeCents;
    const courierFeeCents =
      input.deliveryType === 'delivery' ? COURIER_BASE_FEE_CENTS + input.tipCents : null;

    return {
      commissionRuleId: rule.id,
      platformFeeCents,
      restaurantPayoutCents,
      courierFeeCents,
    };
  }

  /**
   * Sets a new rate for a restaurant. Closes out the current open-ended rule
   * (if any) at "now" and inserts a new one starting now — never mutates an
   * existing rule in place, so past orders' fee snapshots stay accurate.
   */
  async setRate(restaurantId: string, platformFeeBps: number) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.commissionRule.updateMany({
        where: { restaurantId, endsAt: null },
        data: { endsAt: now },
      });
      return tx.commissionRule.create({
        data: { restaurantId, platformFeeBps, startsAt: now },
      });
    });
  }

  listHistory(restaurantId: string) {
    return this.prisma.commissionRule.findMany({
      where: { restaurantId },
      orderBy: { startsAt: 'desc' },
    });
  }
}
