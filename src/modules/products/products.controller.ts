import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiBearerAuth()
@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermissions('products:manage')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  @RequirePermissions('products:manage')
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id/profit-estimate')
  @RequirePermissions('products:manage')
  getProfitEstimate(@Param('id') id: string) {
    return this.productsService.getProfitEstimate(id);
  }

  @Get(':id')
  @RequirePermissions('products:manage')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('products:manage')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('products:manage')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
