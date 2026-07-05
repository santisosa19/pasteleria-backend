import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const productInclude = {
  recipe: {
    select: {
      id: true,
      name: true,
      yieldQuantity: true,
      yieldUnit: true,
    },
  },
} as const;

const productCostInclude = {
  recipe: {
    include: {
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
      },
    },
  },
} as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const name = this.normalizeName(dto.name);
    const sku = this.cleanOptionalString(dto.sku);

    await this.ensureNameIsAvailable(name);

    if (sku) {
      await this.ensureSkuIsAvailable(sku);
    }

    if (dto.recipeId) {
      await this.ensureRecipeExists(dto.recipeId);
    }

    return this.prisma.product.create({
      data: {
        name,
        description: this.cleanOptionalString(dto.description),
        sku,
        recipeId: dto.recipeId,
        salePrice: dto.salePrice,
        isPublished: dto.isPublished ?? false,
        isActive: dto.isActive ?? true,
      },
      include: productInclude,
    });
  }

  findAll() {
    return this.prisma.product.findMany({
      include: productInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      include: productInclude,
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async getProfitEstimate(id: string) {
    const product = await this.prisma.product.findUnique({
      include: productCostInclude,
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.recipe) {
      throw new BadRequestException('Product has no recipe assigned');
    }

    const ingredientCosts = product.recipe.ingredients.map((ingredient) => {
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
    const recipeTotalCost = ingredientCosts.reduce(
      (sum, ingredient) => sum + ingredient.totalCost,
      0,
    );
    const estimatedUnitCost =
      recipeTotalCost / Number(product.recipe.yieldQuantity);
    const salePrice = Number(product.salePrice);
    const grossProfit = salePrice - estimatedUnitCost;
    const marginPercent = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;

    return {
      productId: product.id,
      productName: product.name,
      salePrice,
      recipeId: product.recipe.id,
      recipeName: product.recipe.name,
      recipeTotalCost,
      recipeYieldQuantity: Number(product.recipe.yieldQuantity),
      recipeYieldUnitCode: product.recipe.yieldUnit.code,
      estimatedUnitCost,
      grossProfit,
      marginPercent,
      ingredients: ingredientCosts,
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    if (dto.name) {
      await this.ensureNameIsAvailable(this.normalizeName(dto.name), id);
    }

    const sku = this.cleanOptionalString(dto.sku);

    if (sku) {
      await this.ensureSkuIsAvailable(sku, id);
    }

    if (dto.recipeId) {
      await this.ensureRecipeExists(dto.recipeId);
    }

    return this.prisma.product.update({
      data: {
        name: dto.name ? this.normalizeName(dto.name) : undefined,
        description: this.cleanOptionalString(dto.description),
        sku,
        recipeId: dto.recipeId,
        salePrice: dto.salePrice,
        isPublished: dto.isPublished,
        isActive: dto.isActive,
      },
      include: productInclude,
      where: { id },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.update({
      data: { isActive: false },
      include: productInclude,
      where: { id },
    });
  }

  private async ensureNameIsAvailable(name: string, currentId?: string) {
    const existing = await this.prisma.product.findUnique({
      where: { name },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException('Product name already exists');
    }
  }

  private async ensureSkuIsAvailable(sku: string, currentId?: string) {
    const existing = await this.prisma.product.findUnique({
      where: { sku },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException('Product SKU already exists');
    }
  }

  private async ensureRecipeExists(recipeId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    if (!recipe.isActive) {
      throw new BadRequestException('Recipe is inactive');
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
