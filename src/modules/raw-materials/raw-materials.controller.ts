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
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';
import { RawMaterialsService } from './raw-materials.service';

@ApiBearerAuth()
@ApiTags('raw-materials')
@Controller('raw-materials')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RawMaterialsController {
  constructor(private readonly rawMaterialsService: RawMaterialsService) {}

  @Post()
  @RequirePermissions('raw-materials:manage')
  create(@Body() dto: CreateRawMaterialDto) {
    return this.rawMaterialsService.create(dto);
  }

  @Get()
  @RequirePermissions('raw-materials:manage')
  findAll() {
    return this.rawMaterialsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('raw-materials:manage')
  findOne(@Param('id') id: string) {
    return this.rawMaterialsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('raw-materials:manage')
  update(@Param('id') id: string, @Body() dto: UpdateRawMaterialDto) {
    return this.rawMaterialsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('raw-materials:manage')
  remove(@Param('id') id: string) {
    return this.rawMaterialsService.remove(id);
  }
}
