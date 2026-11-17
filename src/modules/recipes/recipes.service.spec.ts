import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

describe('Recipe status changes', () => {
  const id = 'cookie-recipe';
  const recipe = { findUnique: jest.fn(), update: jest.fn() };
  const controller = new RecipesController(
    new RecipesService({ recipe } as unknown as PrismaService),
  );

  beforeEach(() => jest.resetAllMocks());

  it.each([true, false])(
    'sets isActive to %s without changing the recipe',
    async (isActive) => {
      recipe.findUnique.mockResolvedValue({ id, isActive: !isActive });
      recipe.update.mockResolvedValue({ id, isActive });

      await expect(
        isActive ? controller.activate(id) : controller.remove(id),
      ).resolves.toEqual({ id, isActive });
      expect(recipe.update).toHaveBeenCalledWith({
        where: { id },
        data: { isActive },
        include: expect.anything() as unknown,
      });
    },
  );

  it('does not update a recipe that does not exist', async () => {
    recipe.findUnique.mockResolvedValue(null);

    await expect(controller.activate(id)).rejects.toThrow(NotFoundException);
    expect(recipe.update).not.toHaveBeenCalled();
  });
});
