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
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { RecipesService } from './recipes.service';

@ApiBearerAuth()
@ApiTags('recipes')
@Controller('recipes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Post()
  @RequirePermissions('recipes:manage')
  create(@Body() dto: CreateRecipeDto) {
    return this.recipesService.create(dto);
  }

  @Get()
  @RequirePermissions('recipes:manage')
  findAll() {
    return this.recipesService.findAll();
  }

  @Get(':id/cost')
  @RequirePermissions('recipes:manage')
  getCost(@Param('id') id: string) {
    return this.recipesService.getCost(id);
  }

  @Get(':id')
  @RequirePermissions('recipes:manage')
  findOne(@Param('id') id: string) {
    return this.recipesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('recipes:manage')
  update(@Param('id') id: string, @Body() dto: UpdateRecipeDto) {
    return this.recipesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('recipes:manage')
  remove(@Param('id') id: string) {
    return this.recipesService.remove(id);
  }
}
