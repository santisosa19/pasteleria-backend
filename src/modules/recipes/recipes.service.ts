import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { RecipeIngredientDto } from './dto/recipe-ingredient.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

const recipeInclude = {
  yieldUnit: true,
  ingredients: {
    include: {
      rawMaterial: {
        include: {
          baseUnit: true,
        },
      },
      unit: true,
    },
    orderBy: {
      rawMaterial: {
        name: 'asc',
      },
    },
  },
} as const;

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRecipeDto) {
    const name = this.normalizeName(dto.name);
    await this.ensureNameIsAvailable(name);
    await this.ensureMeasurementUnitExists(
      dto.yieldUnitId,
      'Yield unit not found',
    );
    await this.validateIngredients(dto.ingredients);

    return this.prisma.recipe.create({
      data: {
        name,
        description: this.cleanOptionalString(dto.description),
        yieldQuantity: dto.yieldQuantity,
        yieldUnitId: dto.yieldUnitId,
        instructions: this.cleanOptionalString(dto.instructions),
        isActive: dto.isActive ?? true,
        ingredients: {
          create: dto.ingredients.map((ingredient) => ({
            rawMaterialId: ingredient.rawMaterialId,
            quantity: ingredient.quantity,
            unitId: ingredient.unitId,
          })),
        },
      },
      include: recipeInclude,
    });
  }

  findAll() {
    return this.prisma.recipe.findMany({
      include: recipeInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      include: recipeInclude,
      where: { id },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    return recipe;
  }

  async getCost(id: string) {
    const recipe = await this.findOne(id);
    const ingredientCosts = recipe.ingredients.map((ingredient) => {
      const quantityBase =
        Number(ingredient.quantity) *
        Number(ingredient.unit.conversionRateToBase);
      const unitBaseCost = Number(ingredient.rawMaterial.averageCost);
      const totalCost = quantityBase * unitBaseCost;

      return {
        rawMaterialId: ingredient.rawMaterialId,
        rawMaterialName: ingredient.rawMaterial.name,
        quantity: Number(ingredient.quantity),
        unitCode: ingredient.unit.code,
        quantityBase,
        baseUnitCode: ingredient.rawMaterial.baseUnit.code,
        unitBaseCost,
        totalCost,
      };
    });
    const totalCost = ingredientCosts.reduce(
      (sum, ingredient) => sum + ingredient.totalCost,
      0,
    );
    const costPerYieldUnit = totalCost / Number(recipe.yieldQuantity);

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      yieldQuantity: Number(recipe.yieldQuantity),
      yieldUnitCode: recipe.yieldUnit.code,
      totalCost,
      costPerYieldUnit,
      ingredients: ingredientCosts,
    };
  }

  async update(id: string, dto: UpdateRecipeDto) {
    await this.findOne(id);

    if (dto.name) {
      await this.ensureNameIsAvailable(this.normalizeName(dto.name), id);
    }

    if (dto.yieldUnitId) {
      await this.ensureMeasurementUnitExists(
        dto.yieldUnitId,
        'Yield unit not found',
      );
    }

    if (dto.ingredients) {
      await this.validateIngredients(dto.ingredients);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.ingredients) {
        await tx.recipeIngredient.deleteMany({
          where: { recipeId: id },
        });
      }

      return tx.recipe.update({
        data: {
          name: dto.name ? this.normalizeName(dto.name) : undefined,
          description: this.cleanOptionalString(dto.description),
          yieldQuantity: dto.yieldQuantity,
          yieldUnitId: dto.yieldUnitId,
          instructions: this.cleanOptionalString(dto.instructions),
          isActive: dto.isActive,
          ingredients: dto.ingredients
            ? {
                create: dto.ingredients.map((ingredient) => ({
                  rawMaterialId: ingredient.rawMaterialId,
                  quantity: ingredient.quantity,
                  unitId: ingredient.unitId,
                })),
              }
            : undefined,
        },
        include: recipeInclude,
        where: { id },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.recipe.update({
      data: { isActive: false },
      include: recipeInclude,
      where: { id },
    });
  }

  private async ensureNameIsAvailable(name: string, currentId?: string) {
    const existing = await this.prisma.recipe.findUnique({
      where: { name },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException('Recipe name already exists');
    }
  }

  private async ensureMeasurementUnitExists(id: string, message: string) {
    const measurementUnit = await this.prisma.measurementUnit.findUnique({
      where: { id },
    });

    if (!measurementUnit) {
      throw new NotFoundException(message);
    }

    return measurementUnit;
  }

  private async validateIngredients(ingredients: RecipeIngredientDto[]) {
    const rawMaterialIds = new Set<string>();

    for (const ingredient of ingredients) {
      if (rawMaterialIds.has(ingredient.rawMaterialId)) {
        throw new ConflictException(
          'Recipe cannot contain the same raw material more than once',
        );
      }

      rawMaterialIds.add(ingredient.rawMaterialId);

      const rawMaterial = await this.prisma.rawMaterial.findUnique({
        include: {
          baseUnit: true,
        },
        where: { id: ingredient.rawMaterialId },
      });

      if (!rawMaterial) {
        throw new NotFoundException('Raw material not found');
      }

      if (!rawMaterial.isActive) {
        throw new BadRequestException('Raw material is inactive');
      }

      const unit = await this.ensureMeasurementUnitExists(
        ingredient.unitId,
        'Ingredient unit not found',
      );

      if (unit.kind !== rawMaterial.baseUnit.kind) {
        throw new BadRequestException(
          'Ingredient unit kind must match raw material base unit kind',
        );
      }
    }
  }

  private normalizeName(name: string) {
    return name.trim();
  }

  private cleanOptionalString(value?: string) {
    const trimmed = value?.trim();

    return trimmed || undefined;
  }
}
