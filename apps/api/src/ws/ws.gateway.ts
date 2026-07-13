import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'ws';
import { WsService } from './ws.service';

/**
 * NestJS WebSocket gateway using the ws adapter (raw WebSocket, not Socket.io).
 * Binds to /api/ws so existing mobile clients can connect without changes.
 * Delegates business logic to WsService — this class only handles lifecycle.
 */
@WebSocketGateway({ path: '/api/ws' })
export class WsGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsService: WsService) {}

  afterInit(server: Server): void {
    // Hand the initialized ws.Server to the service so broadcast() works.
    this.wsService.onServerReady(server);
  }
}
