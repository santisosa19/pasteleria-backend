import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchasesService } from './purchases.service';

@ApiBearerAuth()
@ApiTags('purchases')
@Controller('purchases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @RequirePermissions('purchases:manage')
  create(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchasesService.create(dto, user);
  }

  @Get()
  @RequirePermissions('purchases:manage')
  findAll() {
    return this.purchasesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('purchases:manage')
  findOne(@Param('id') id: string) {
    return this.purchasesService.findOne(id);
  }
}
