"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeastWindowsModule = void 0;
const common_1 = require("@nestjs/common");
const feast_windows_controller_1 = require("./feast-windows.controller");
const feast_windows_service_1 = require("./feast-windows.service");
const feast_window_expiry_service_1 = require("./feast-window-expiry.service");
let FeastWindowsModule = class FeastWindowsModule {
};
exports.FeastWindowsModule = FeastWindowsModule;
exports.FeastWindowsModule = FeastWindowsModule = __decorate([
    (0, common_1.Module)({
        controllers: [feast_windows_controller_1.FeastWindowsController],
        providers: [feast_windows_service_1.FeastWindowsService, feast_window_expiry_service_1.FeastWindowExpiryService],
    })
], FeastWindowsModule);
