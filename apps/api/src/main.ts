import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

// Allow BigInt values to serialize cleanly to JSON (used for FeastWindow.endTime).
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

// SECURITY: comma-separated allowlist, e.g. "https://admin.letsfeast.co,https://restaurant.letsfeast.co".
// Required in production; falls back to common local dev ports otherwise.
function resolveCorsOrigins(): string[] {
  const raw = process.env['CORS_ORIGINS'];
  if (raw) return raw.split(',').map((o) => o.trim()).filter(Boolean);
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('CORS_ORIGINS environment variable is required in production');
  }
  return ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use the ws-based WebSocket adapter so @WebSocketGateway uses raw WebSocket
  // (matching the legacy Express server) rather than Socket.io.
  app.useWebSocketAdapter(new WsAdapter(app));

  app.enableCors({ origin: resolveCorsOrigins(), credentials: true });
  // All feature routes live under /api/* to match the Express server's convention.
  app.setGlobalPrefix('api');

  const port = process.env['PORT'] ?? 8080;
  await app.listen(port, '0.0.0.0');
  console.log(`FEAST NestJS API listening on port ${port}`);
}
bootstrap();
