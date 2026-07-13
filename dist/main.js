"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_ws_1 = require("@nestjs/platform-ws");
const app_module_1 = require("./app.module");
// Allow BigInt values to serialize cleanly to JSON (used for FeastWindow.endTime).
BigInt.prototype.toJSON = function () {
    return Number(this);
};
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    // Use the ws-based WebSocket adapter so @WebSocketGateway uses raw WebSocket
    // (matching the legacy Express server) rather than Socket.io.
    app.useWebSocketAdapter(new platform_ws_1.WsAdapter(app));
    app.enableCors();
    // All feature routes live under /api/* to match the Express server's convention.
    app.setGlobalPrefix('api');
    const port = process.env['PORT'] ?? 8080;
    await app.listen(port, '0.0.0.0');
    console.log(`FEAST NestJS API listening on port ${port}`);
}
bootstrap();
