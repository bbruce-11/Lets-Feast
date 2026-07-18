/**
 * Demo-seed auto-progression script.
 *
 * Creates a handful of demo customer/driver accounts (idempotent - safe to
 * re-run), seeds a rolling set of orders against whatever restaurants +
 * menu items actually exist in the database, and advances them through
 * their real status flow on a timer - so the admin console, restaurant
 * dashboard, customer app, and courier app all show live-looking activity
 * during the demo without anyone needing to click through it manually.
 *
 * Deliberately bypasses the HTTP API and Stripe entirely - orders are
 * inserted directly via Prisma, using the same CommissionService the real
 * checkout flow uses, so the fee breakdown is realistic without needing a
 * real card charge for every fake demo order. Every SUBSEQUENT status
 * transition, though, calls the real OrdersService/CourierService methods
 * (advanceOrder, claimOrder, updateDeliveryStatus) rather than
 * reimplementing that logic here, so behavior - including the WebSocket
 * broadcasts every UI surface depends on - matches production exactly.
 *
 * Usage:
 *   pnpm --filter @feast/api run demo:seed
 *
 * Runs until you Ctrl+C. Safe to start a few minutes before the demo and
 * leave running throughout.
 */

import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CommissionService } from '../src/shared/commission.service';
import { OrdersService } from '../src/orders/orders.service';
import { CourierService } from '../src/courier/courier.service';

const ADVANCE_INTERVAL_MS = Number(process.env.DEMO_ADVANCE_INTERVAL_MS ?? 20_000);
const MAX_CONCURRENT_ORDERS = Number(process.env.DEMO_MAX_ORDERS ?? 4);
const DEMO_PASSWORD = 'demo1234';

const DEMO_CUSTOMERS = [
  { email: 'demo-customer-1@letsfeast.demo', fullName: 'Jordan Ellis' },
  { email: 'demo-customer-2@letsfeast.demo', fullName: 'Priya Nair' },
  { email: 'demo-customer-3@letsfeast.demo', fullName: 'Marcus Webb' },
];
const DEMO_DRIVER = { email: 'demo-driver@letsfeast.demo', fullName: 'Sam Rivera' };
const DEMO_ADDRESSES = [
  '742 Evergreen Terrace, Apt 3',
  '221 Oak Street',
  '1600 Maple Ave, Unit 12',
];

interface TrackedOrder {
  id: number;
  status: string;
  deliveryType: string;
}

async function findOrCreateUser(
  prisma: PrismaService,
  input: { email: string; fullName: string; role: string },
) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.create({
    data: { email: input.email, fullName: input.fullName, passwordHash, role: input.role, phone: '555-0100' },
  });
}

async function main() {
  console.log('Starting demo-seed auto-progression...\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const commission = app.get(CommissionService);
  const orders = app.get(OrdersService);
  const courier = app.get(CourierService);

  // --- Set up demo accounts (idempotent) ---
  const customers = await Promise.all(
    DEMO_CUSTOMERS.map((c) => findOrCreateUser(prisma, { ...c, role: 'customer' })),
  );
  const driver = await findOrCreateUser(prisma, { ...DEMO_DRIVER, role: 'driver' });
  console.log(`Demo accounts ready (password: ${DEMO_PASSWORD})`);
  console.log(`  Customers: ${customers.map((c) => c.email).join(', ')}`);
  console.log(`  Driver: ${driver.email}\n`);

  // --- Load real restaurant + menu data ---
  const restaurants = await prisma.restaurant.findMany({
    include: { menuItems: true, commissionRules: { where: { endsAt: null } } },
  });
  const usable = restaurants.filter((r) => r.menuItems.length > 0 && r.commissionRules.length > 0);

  if (usable.length === 0) {
    console.error(
      'No restaurants with both menu items AND an active commission rule found.\n' +
        'Onboard at least one restaurant via the admin console (Add Restaurant) before running this script.',
    );
    await app.close();
    process.exit(1);
  }
  console.log(`Seeding against ${usable.length} restaurant(s): ${usable.map((r) => r.name).join(', ')}\n`);

  const tracked: TrackedOrder[] = [];

  async function createDemoOrder(): Promise<void> {
    const restaurant = usable[Math.floor(Math.random() * usable.length)];
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const itemCount = 1 + Math.floor(Math.random() * 3);
    const pickedItems = Array.from({ length: itemCount }, () => {
      const menuItem = restaurant.menuItems[Math.floor(Math.random() * restaurant.menuItems.length)];
      const quantity = 1 + Math.floor(Math.random() * 2);
      return { menuItem, quantity };
    });

    const subtotalCents = pickedItems.reduce(
      (sum, { menuItem, quantity }) => sum + Math.round(Number(menuItem.price) * 100) * quantity,
      0,
    );
    const tipCents = [0, 300, 500][Math.floor(Math.random() * 3)];
    const deliveryType = Math.random() < 0.85 ? 'delivery' : 'pickup';

    const breakdown = await commission.computeFees({
      restaurantId: restaurant.id,
      subtotalCents,
      tipCents,
      deliveryType,
    });

    const deliveryFeeCents = deliveryType === 'delivery' ? 299 : 0;
    const serviceFeeCents = Math.round(subtotalCents * 0.05);
    const totalCents = subtotalCents + deliveryFeeCents + serviceFeeCents + tipCents;

    const lineItems = pickedItems.map(({ menuItem, quantity }) => ({
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: Number(menuItem.price),
      quantity,
    }));

    const created = await prisma.order.create({
      data: {
        userId: customer.id,
        restaurantId: restaurant.id,
        deliveryType,
        deliveryAddress:
          deliveryType === 'delivery' ? DEMO_ADDRESSES[Math.floor(Math.random() * DEMO_ADDRESSES.length)] : null,
        items: lineItems as unknown as Prisma.InputJsonValue,
        subtotal: (subtotalCents / 100).toFixed(2),
        total: (totalCents / 100).toFixed(2),
        tipCents,
        commissionRuleId: breakdown.commissionRuleId,
        platformFeeCents: breakdown.platformFeeCents,
        restaurantPayoutCents: breakdown.restaurantPayoutCents,
        courierFeeCents: breakdown.courierFeeCents,
        paymentIntentId: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        paymentStatus: 'succeeded',
        status: 'confirmed',
        statusManual: true,
        confirmedAt: new Date(),
      } as Prisma.OrderUncheckedCreateInput,
    });

    tracked.push({ id: created.id, status: 'confirmed', deliveryType });
    console.log(`  + New order #${created.id} at ${restaurant.name} (${deliveryType}, $${(totalCents / 100).toFixed(2)})`);
  }

  async function advanceOne(entry: TrackedOrder): Promise<void> {
    try {
      if (entry.deliveryType === 'pickup') {
        // Pickup orders never involve a driver - just walk the plain flow.
        const result = await orders.advanceOrder(entry.id);
        entry.status = result.status;
      } else if (entry.status === 'preparing') {
        // Real courier claim flow, not a plain status advance - this is
        // what actually makes the order show up in the courier app.
        await courier.claimOrder(entry.id, driver.id);
        entry.status = 'driver_assigned';
      } else if (entry.status === 'driver_assigned') {
        await courier.updateDeliveryStatus(entry.id, 'on_the_way', driver.id, 'driver');
        entry.status = 'on_the_way';
      } else if (entry.status === 'on_the_way') {
        await courier.updateDeliveryStatus(entry.id, 'delivered', driver.id, 'driver');
        entry.status = 'delivered';
      } else {
        const result = await orders.advanceOrder(entry.id);
        entry.status = result.status;
      }
      console.log(`  -> Order #${entry.id} advanced to ${entry.status}`);
    } catch (err) {
      console.error(`  ! Failed to advance order #${entry.id}:`, err instanceof Error ? err.message : err);
    }
  }

  async function tick(): Promise<void> {
    // Advance every non-terminal tracked order.
    const active = tracked.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
    await Promise.all(active.map(advanceOne));

    // Drop delivered orders from tracking (they stay in the DB, just stop
    // being auto-advanced) and top up back to the target concurrent count.
    const stillActive = tracked.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
    tracked.length = 0;
    tracked.push(...stillActive);

    while (tracked.length < MAX_CONCURRENT_ORDERS) {
      await createDemoOrder();
    }
  }

  // Prime the pump, then run on a fixed interval until stopped.
  await tick();
  const interval = setInterval(() => {
    tick().catch((err) => console.error('Tick failed:', err));
  }, ADVANCE_INTERVAL_MS);

  console.log(`\nRunning - advancing orders every ${ADVANCE_INTERVAL_MS / 1000}s. Press Ctrl+C to stop.\n`);

  process.on('SIGINT', async () => {
    clearInterval(interval);
    await app.close();
    console.log('\nStopped.');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
