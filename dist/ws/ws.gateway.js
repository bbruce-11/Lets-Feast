"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const ws_service_1 = require("./ws.service");
/**
 * NestJS WebSocket gateway using the ws adapter (raw WebSocket, not Socket.io).
 * Binds to /api/ws so existing mobile clients can connect without changes.
 * Delegates business logic to WsService — this class only handles lifecycle.
 */
let WsGateway = class WsGateway {
    constructor(wsService) {
        this.wsService = wsService;
    }
    afterInit(server) {
        // Hand the initialized ws.Server to the service so broadcast() works.
        this.wsService.onServerReady(server);
    }
};
exports.WsGateway = WsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", Function)
], WsGateway.prototype, "server", void 0);
exports.WsGateway = WsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ path: '/api/ws' }),
    __metadata("design:paramtypes", [ws_service_1.WsService])
], WsGateway);
