import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FeastWindowsService } from './feast-windows.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthRequest } from '../common/decorators/current-user.decorator';

@Controller('feast-windows')
export class FeastWindowsController {
  constructor(private readonly fwService: FeastWindowsService) {}

  @Get()
  list() {
    return this.fwService.list();
  }

  @Get('me/joined')
  @UseGuards(JwtAuthGuard)
  getJoined(@Req() req: AuthRequest) {
    return this.fwService.getJoined(req.user.userId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.fwService.get(id);
  }

  @Post(':id/join')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  join(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.fwService.join(id, req.user.userId);
  }
}
