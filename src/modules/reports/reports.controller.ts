import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ReportPeriodQueryDto } from './dto/report-period-query.dto';
import { ReportsService } from './reports.service';

@ApiBearerAuth()
@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-summary')
  @RequirePermissions('reports:read')
  getSalesSummary(@Query() query: ReportPeriodQueryDto) {
    return this.reportsService.getSalesSummary(query);
  }

  @Get('product-margins')
  @RequirePermissions('reports:read')
  getProductMargins(@Query() query: ReportPeriodQueryDto) {
    return this.reportsService.getProductMargins(query);
  }

  @Get('purchases-by-supplier')
  @RequirePermissions('reports:read')
  getPurchasesBySupplier(@Query() query: ReportPeriodQueryDto) {
    return this.reportsService.getPurchasesBySupplier(query);
  }

  @Get('raw-material-consumption')
  @RequirePermissions('reports:read')
  getRawMaterialConsumption(@Query() query: ReportPeriodQueryDto) {
    return this.reportsService.getRawMaterialConsumption(query);
  }
}
