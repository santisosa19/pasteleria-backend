import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@ApiBearerAuth()
@ApiTags('sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @RequirePermissions('sales:manage')
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.create(dto, user);
  }

  @Get()
  @RequirePermissions('sales:manage')
  findAll() {
    return this.salesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('sales:manage')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Post(':id/cancel')
  @RequirePermissions('sales:manage')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.cancel(id, dto, user);
  }
}
