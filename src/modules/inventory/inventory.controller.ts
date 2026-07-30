import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { InventoryService } from './inventory.service';

@ApiBearerAuth()
@ApiTags('inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('movements')
  @RequirePermissions('inventory:movements:read')
  findMovements(@Query() query: StockMovementQueryDto) {
    return this.inventoryService.findMovements(query);
  }

  @Get('low-stock')
  @RequirePermissions('inventory:low-stock:read')
  findLowStock() {
    return this.inventoryService.findLowStock();
  }

  @Post('adjustments')
  @RequirePermissions('inventory:adjustments:create')
  createAdjustment(
    @Body() dto: CreateStockAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.createAdjustment(dto, user);
  }
}
