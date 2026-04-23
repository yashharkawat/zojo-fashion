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

  if (saveForLater) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.address.create({
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
}
