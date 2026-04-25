import { prisma } from '../../config/prisma';
import type { CreateAddressBody } from './addresses.schema';

export async function listForUser(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      fullName: true,
      phone: true,
      line1: true,
      line2: true,
      landmark: true,
      city: true,
      state: true,
      pincode: true,
      isDefault: true,
      createdAt: true,
    },
  });
}

export async function createForUser(userId: string, input: CreateAddressBody) {
  const { saveForLater, ...rest } = input;

  const [, address] = await prisma.$transaction(async (tx) => {
    if (saveForLater) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Back-fill the user's own phone if they don't have one yet (e.g. Google sign-up).
    await tx.user.updateMany({
      where: { id: userId, phone: null },
      data: { phone: rest.phone },
    });

    const created = await tx.address.create({
      data: {
        userId,
        type: 'HOME',
        fullName: rest.fullName,
        phone: rest.phone,
        line1: rest.line1,
        line2: rest.line2,
        landmark: rest.landmark,
        city: rest.city,
        state: rest.state,
        pincode: rest.pincode,
        country: 'IN',
        isDefault: saveForLater,
      },
      select: { id: true, fullName: true, phone: true, isDefault: true, createdAt: true },
    });

    return [null, created] as const;
  });

  return address;
}
