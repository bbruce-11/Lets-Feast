# Let's Feast

A group food-ordering platform with a customer mobile app, real-time order tracking, Feast Windows (time-limited group deals), and a restaurant staff dashboard.

## What it does

- **Customers** browse restaurants, join Feast Windows (group deals that unlock when enough diners participate), place orders, and track delivery in real time.
- **Restaurant staff** watch and manually advance incoming orders on a live board.
- **Couriers** see assigned orders and advance delivery status from their own app.
- **Admins** manage the restaurant catalogue.

## Main apps

- **[Let's Feast — Customer App](./apps/customer)** — Expo mobile app for diners
- **[Staff Order Console](./apps/restaurant)** — Next.js live order board for restaurant staff

Other apps: [Admin Console](./apps/admin) · [Courier App](./apps/courier) · [API Server](./apps/api)

## Stack

- **Mobile**: Expo (React Native), Expo Router
- **Web dashboards**: Next.js 14, TailwindCSS v4
- **API**: NestJS (migrated from Express), JWT auth, WebSocket gateway
- **Database**: PostgreSQL + Prisma ORM (migrated from Drizzle)
- **Payments**: Stripe
- **Monorepo**: pnpm workspaces, TypeScript 5, Node.js 24

## Local setup

```bash
# 1. Clone the repo
git clone https://github.com/bbruce-11/Lets-Feast.git
cd Lets-Feast

# 2. Install dependencies
pnpm install

# 3. Set required environment variable
#    DATABASE_URL=postgres://...

# 4. Push the schema and seed data
pnpm --filter @workspace/db push
pnpm --filter @workspace/db seed

# 5. Start the API
pnpm --filter @feast/api run dev          # http://localhost:8080

# 6. Start the web dashboards (separate terminals)
pnpm --filter @feast/restaurant run dev   # http://localhost:20150 (external port 3000)
pnpm --filter @feast/admin run dev        # http://localhost:20151 (external port 3002)

# 7. Start the customer or courier mobile app
pnpm --filter @feast/customer run dev
pnpm --filter @feast/courier run start
```

## Useful commands

```bash
pnpm run typecheck   # typecheck all packages
pnpm run build       # typecheck + build all packages
```
