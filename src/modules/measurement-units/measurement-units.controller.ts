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
import { CreateMeasurementUnitDto } from './dto/create-measurement-unit.dto';
import { UpdateMeasurementUnitDto } from './dto/update-measurement-unit.dto';
import { MeasurementUnitsService } from './measurement-units.service';

@ApiBearerAuth()
@ApiTags('measurement-units')
@Controller('measurement-units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MeasurementUnitsController {
  constructor(
    private readonly measurementUnitsService: MeasurementUnitsService,
  ) {}

  @Post()
  @RequirePermissions('measurement-units:manage')
  create(@Body() dto: CreateMeasurementUnitDto) {
    return this.measurementUnitsService.create(dto);
  }

  @Get()
  @RequirePermissions('measurement-units:manage')
  findAll() {
    return this.measurementUnitsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('measurement-units:manage')
  findOne(@Param('id') id: string) {
    return this.measurementUnitsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('measurement-units:manage')
  update(@Param('id') id: string, @Body() dto: UpdateMeasurementUnitDto) {
    return this.measurementUnitsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('measurement-units:manage')
  remove(@Param('id') id: string) {
    return this.measurementUnitsService.remove(id);
  }
}
