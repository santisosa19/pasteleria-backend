import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { PrismaService } from '../database/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchasesService } from './purchases.service';

const rawMaterialId = '4b5dc128-e470-444f-adb4-5c668d2972cd';
const unitId = 'e2486214-db5a-4386-97e6-8f7391c0039c';
const user = { id: 'test-user' } as AuthenticatedUser;
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

function validatePurchase(item: Record<string, unknown>) {
  return pipe.transform(
    { items: [{ rawMaterialId, unitId, quantity: 30, ...item }] },
    { type: 'body', metatype: CreatePurchaseDto },
  ) as Promise<CreatePurchaseDto>;
}

describe('PurchasesService', () => {
  const material = {
    isActive: true,
    baseUnit: { kind: 'COUNT' },
    currentStock: new Prisma.Decimal(0),
    averageCost: new Prisma.Decimal(0),
  };
  const tx = {
    purchase: {
      create: jest
        .fn<Promise<{ id: string }>, [Prisma.PurchaseCreateArgs]>()
        .mockResolvedValue({ id: 'test-purchase' }),
      findUniqueOrThrow: jest.fn(),
    },
    rawMaterial: {
      findUnique: jest.fn().mockResolvedValue(material),
      update: jest.fn<void, [Prisma.RawMaterialUpdateArgs]>(),
    },
    auditLog: { create: jest.fn() },
    stockMovement: {
      create: jest.fn<void, [Prisma.StockMovementCreateArgs]>(),
    },
  };
  const transaction = jest.fn((callback: (db: typeof tx) => unknown) =>
    callback(tx),
  );
  const service = new PurchasesService({
    $transaction: transaction,
    rawMaterial: tx.rawMaterial,
    measurementUnit: {
      findUnique: jest.fn().mockResolvedValue({
        kind: 'COUNT',
        conversionRateToBase: new Prisma.Decimal(1),
      }),
    },
  } as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it.each([
    [30, '216.6667'],
    [300, '21.6667'],
  ])(
    'keeps the $6500 invoice total for %i eggs',
    async (quantity, unitCost) => {
      await service.create(
        await validatePurchase({ quantity, lineTotal: 6500 }),
        user,
      );

      expect(tx.purchase.create.mock.calls[0]?.[0].data).toMatchObject({
        totalAmount: new Prisma.Decimal(6500),
        items: {
          create: [
            {
              rawMaterialId,
              unitId,
              quantity,
              unitCost: new Prisma.Decimal(unitCost),
              subtotal: new Prisma.Decimal(6500),
            },
          ],
        },
      });
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
      expect(tx.stockMovement.create.mock.calls[0]?.[0].data).toMatchObject({
        quantityBase: new Prisma.Decimal(quantity),
      });
      expect(tx.rawMaterial.update.mock.calls[0]?.[0]).toMatchObject({
        where: { id: rawMaterialId },
        data: { currentStock: new Prisma.Decimal(quantity) },
      });
    },
  );

  it('still accepts a unit cost from existing clients', async () => {
    await service.create(await validatePurchase({ unitCost: 210.25 }), user);

    expect(tx.purchase.create.mock.calls[0]?.[0].data).toMatchObject({
      totalAmount: new Prisma.Decimal('6307.50'),
    });
  });

  it.each([{}, { lineTotal: 6500, unitCost: 210 }])(
    'rejects missing or ambiguous costs without writing a purchase (%j)',
    async (item) => {
      await expect(
        service.create(await validatePurchase(item), user),
      ).rejects.toThrow(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects an invoice amount with fractions of a cent', async () => {
    await expect(validatePurchase({ lineTotal: 6500.001 })).rejects.toThrow(
      BadRequestException,
    );
  });
});
