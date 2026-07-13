import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

let wss: WebSocketServer | null = null;

export function createWss(): WebSocketServer {
  wss = new WebSocketServer({ noServer: true });
  return wss;
}

export function getWss(): WebSocketServer | null {
  return wss;
}

export function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
  if (!wss) return;
  const url = req.url ?? '';
  if (url === '/api/ws' || url.startsWith('/api/ws?')) {
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      wss!.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
}

export function broadcast(msg: object): void {
  if (!wss) return;
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}
