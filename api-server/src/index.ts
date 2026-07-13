import http from 'http';
import app from './app';
import { logger } from './lib/logger';
import { createWss, handleUpgrade } from './lib/ws';
import { scheduleExpiryBroadcasts } from './lib/expiry';
import { scheduleOrderNotifications } from './lib/orderNotifications';
import { startOrderTrackingBroadcasts } from './lib/orderTracking';

const rawPort = process.env['PORT'];

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);
createWss();

server.on('upgrade', (req, socket, head) => {
  handleUpgrade(req, socket as any, head as any);
});

server.listen(port, async (err?: Error) => {
  if (err) {
    logger.error({ err }, 'Error listening on port');
    process.exit(1);
  }

  logger.info({ port }, 'Server listening');

  await scheduleExpiryBroadcasts();
  await scheduleOrderNotifications();

  // Push live driver position + ETA over the existing WebSocket so the tracking
  // screen updates in real time instead of waiting for its next poll.
  startOrderTrackingBroadcasts();

  setInterval(() => {
    scheduleExpiryBroadcasts().catch((err) => {
      logger.error({ err }, 'expiry re-schedule error');
    });
    scheduleOrderNotifications().catch((err) => {
      logger.error({ err }, 'order notification re-schedule error');
    });
  }, 60_000);
});
