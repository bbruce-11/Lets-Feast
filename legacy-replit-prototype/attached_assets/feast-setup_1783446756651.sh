#!/usr/bin/env bash
# =============================================================================
# FEAST (letsfeast.co) — Monorepo Setup Script
# =============================================================================
# Run this ONCE inside the Replit shell to scaffold the pnpm monorepo:
#   - apps/api            NestJS + Prisma backend
#   - apps/restaurant      Next.js restaurant dashboard
#   - apps/admin           Next.js admin console
#   - apps/customer        Expo (React Native) customer app
#   - apps/courier         Expo (React Native) courier app
#
# Usage (from Replit shell, in the repo root):
#   chmod +x feast-setup.sh
#   ./feast-setup.sh
#
# Safe to re-run: existing directories are skipped, not overwritten.
# =============================================================================

set -euo pipefail

echo "=============================================="
echo " FEAST monorepo setup starting..."
echo "=============================================="

# -----------------------------------------------------------------------------
# 0. Sanity checks
# -----------------------------------------------------------------------------
command -v node >/dev/null 2>&1 || { echo "Node.js not found. Add a Node module in Replit first."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm not found, installing via corepack..."; corepack enable && corepack prepare pnpm@latest --activate; }

echo "Node version: $(node -v)"
echo "pnpm version: $(pnpm -v)"

# -----------------------------------------------------------------------------
# 1. Root workspace files
# -----------------------------------------------------------------------------
if [ ! -f "pnpm-workspace.yaml" ]; then
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF
echo "Created pnpm-workspace.yaml"
fi

if [ ! -f "package.json" ]; then
cat > package.json <<'EOF'
{
  "name": "feast-monorepo",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev:api": "pnpm --filter @feast/api dev",
    "dev:restaurant": "pnpm --filter @feast/restaurant dev",
    "dev:admin": "pnpm --filter @feast/admin dev",
    "dev:customer": "pnpm --filter @feast/customer start",
    "dev:courier": "pnpm --filter @feast/courier start",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  }
}
EOF
echo "Created root package.json"
fi

mkdir -p apps packages

# -----------------------------------------------------------------------------
# 2. apps/api — NestJS + Prisma backend
# -----------------------------------------------------------------------------
if [ ! -d "apps/api" ]; then
  echo "Scaffolding apps/api (NestJS)..."
  mkdir -p apps/api
  pushd apps/api >/dev/null

  cat > package.json <<'EOF'
{
  "name": "@feast/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start:prod": "node dist/main",
    "typecheck": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/websockets": "^10.4.0",
    "@nestjs/platform-socket.io": "^10.4.0",
    "@prisma/client": "^5.19.0",
    "socket.io": "^4.7.5",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.5",
    "@types/node": "^20.14.0",
    "prisma": "^5.19.0",
    "typescript": "^5.5.0"
  }
}
EOF

  mkdir -p src prisma
  cat > prisma/schema.prisma <<'EOF'
// FEAST data model — fill in with the confirmed schema
// (users, restaurants, menu items, orders, commission rules, etc.)
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  role      String   // customer | restaurant_staff | courier | admin
  createdAt DateTime @default(now())
}
EOF

  cat > src/main.ts <<'EOF'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = process.env.PORT ?? 8080;
  await app.listen(port, '0.0.0.0');
  console.log(`FEAST API listening on port ${port}`);
}
bootstrap();
EOF

  cat > src/app.module.ts <<'EOF'
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
EOF

  cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "skipLibCheck": true
  }
}
EOF

  cat > .env.example <<'EOF'
DATABASE_URL="postgresql://user:password@localhost:5432/feast"
JWT_SECRET="replace-me"
EOF

  popd >/dev/null
  echo "apps/api scaffolded."
else
  echo "apps/api already exists, skipping."
fi

# -----------------------------------------------------------------------------
# 3. apps/restaurant — Next.js restaurant dashboard
# -----------------------------------------------------------------------------
if [ ! -d "apps/restaurant" ]; then
  echo "Scaffolding apps/restaurant (Next.js)..."
  mkdir -p apps/restaurant
  pushd apps/restaurant >/dev/null

  cat > package.json <<'EOF'
{
  "name": "@feast/restaurant",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "socket.io-client": "^4.7.5"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "typescript": "^5.5.0"
  }
}
EOF

  mkdir -p app
  cat > app/layout.tsx <<'EOF'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
EOF

  cat > app/page.tsx <<'EOF'
export default function RestaurantDashboardHome() {
  return <main>FEAST Restaurant Dashboard — scaffold</main>;
}
EOF

  cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "strict": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
EOF

  popd >/dev/null
  echo "apps/restaurant scaffolded."
else
  echo "apps/restaurant already exists, skipping."
fi

# -----------------------------------------------------------------------------
# 4. apps/admin — Next.js admin console
# -----------------------------------------------------------------------------
if [ ! -d "apps/admin" ]; then
  echo "Scaffolding apps/admin (Next.js)..."
  mkdir -p apps/admin
  pushd apps/admin >/dev/null

  cat > package.json <<'EOF'
{
  "name": "@feast/admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start -p 3002",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "typescript": "^5.5.0"
  }
}
EOF

  mkdir -p app
  cat > app/layout.tsx <<'EOF'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
EOF

  cat > app/page.tsx <<'EOF'
export default function AdminHome() {
  return <main>FEAST Admin Console — scaffold</main>;
}
EOF

  cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "strict": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
EOF

  popd >/dev/null
  echo "apps/admin scaffolded."
else
  echo "apps/admin already exists, skipping."
fi

# -----------------------------------------------------------------------------
# 5. apps/customer — Expo customer app
# -----------------------------------------------------------------------------
if [ ! -d "apps/customer" ]; then
  echo "Scaffolding apps/customer (Expo)..."
  mkdir -p apps/customer
  pushd apps/customer >/dev/null

  cat > package.json <<'EOF'
{
  "name": "@feast/customer",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --port 19000",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "react": "18.2.0",
    "react-native": "0.74.5",
    "socket.io-client": "^4.7.5"
  },
  "devDependencies": {
    "@types/react": "~18.2.79",
    "typescript": "^5.5.0"
  }
}
EOF

  mkdir -p app
  cat > app/_layout.tsx <<'EOF'
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack />;
}
EOF

  cat > app/index.tsx <<'EOF'
import { Text, View } from 'react-native';

export default function Home() {
  return (
    <View>
      <Text>FEAST Customer App — scaffold</Text>
    </View>
  );
}
EOF

  cat > app.json <<'EOF'
{
  "expo": {
    "name": "FEAST",
    "slug": "feast-customer",
    "scheme": "feastcustomer",
    "version": "0.1.0",
    "orientation": "portrait",
    "platforms": ["ios", "android"]
  }
}
EOF

  cat > tsconfig.json <<'EOF'
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
EOF

  popd >/dev/null
  echo "apps/customer scaffolded."
else
  echo "apps/customer already exists, skipping."
fi

# -----------------------------------------------------------------------------
# 6. apps/courier — Expo courier app
# -----------------------------------------------------------------------------
if [ ! -d "apps/courier" ]; then
  echo "Scaffolding apps/courier (Expo)..."
  mkdir -p apps/courier
  pushd apps/courier >/dev/null

  cat > package.json <<'EOF'
{
  "name": "@feast/courier",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --port 19001",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "react": "18.2.0",
    "react-native": "0.74.5",
    "socket.io-client": "^4.7.5"
  },
  "devDependencies": {
    "@types/react": "~18.2.79",
    "typescript": "^5.5.0"
  }
}
EOF

  mkdir -p app
  cat > app/_layout.tsx <<'EOF'
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack />;
}
EOF

  cat > app/index.tsx <<'EOF'
import { Text, View } from 'react-native';

export default function Home() {
  return (
    <View>
      <Text>FEAST Courier App — scaffold</Text>
    </View>
  );
}
EOF

  cat > app.json <<'EOF'
{
  "expo": {
    "name": "FEAST Courier",
    "slug": "feast-courier",
    "scheme": "feastcourier",
    "version": "0.1.0",
    "orientation": "portrait",
    "platforms": ["ios", "android"]
  }
}
EOF

  cat > tsconfig.json <<'EOF'
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
EOF

  popd >/dev/null
  echo "apps/courier scaffolded."
else
  echo "apps/courier already exists, skipping."
fi

# -----------------------------------------------------------------------------
# 7. .replit / .gitignore
# -----------------------------------------------------------------------------
if [ ! -f ".gitignore" ]; then
cat > .gitignore <<'EOF'
node_modules/
dist/
.next/
.expo/
.env
*.log
EOF
echo "Created .gitignore"
fi

# -----------------------------------------------------------------------------
# 8. Install dependencies
# -----------------------------------------------------------------------------
echo "=============================================="
echo " Installing dependencies (pnpm install)..."
echo "=============================================="
pnpm install

echo "=============================================="
echo " FEAST monorepo setup complete."
echo ""
echo " Structure:"
echo "   apps/api          NestJS + Prisma backend      (port 8080)"
echo "   apps/restaurant   Next.js restaurant dashboard  (port 3001)"
echo "   apps/admin        Next.js admin console         (port 3002)"
echo "   apps/customer     Expo customer app              (port 19000)"
echo "   apps/courier      Expo courier app               (port 19001)"
echo ""
echo " Next steps:"
echo "   1. Copy apps/api/.env.example to apps/api/.env and set DATABASE_URL / JWT_SECRET"
echo "   2. Replace apps/api/prisma/schema.prisma with the full confirmed data model"
echo "   3. pnpm --filter @feast/api prisma:migrate"
echo "   4. Configure Replit's [[ports]] in .replit for 8080, 3001, 3002, 19000, 19001"
echo "   5. Run each app: pnpm dev:api / dev:restaurant / dev:admin / dev:customer / dev:courier"
echo "=============================================="
