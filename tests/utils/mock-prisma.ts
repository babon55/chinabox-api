import { PrismaClient } from '@prisma/client'

export function createMockPrisma() {
  const mock = {} as Partial<PrismaClient>

  // Orders
  mock.order = {
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }

  // OrderLine
  mock.orderLine = {
    create: vi.fn(),
    delete: vi.fn(),
  }

  // Customer
  mock.customer = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }

  // Product
  mock.product = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
  }

  // User (admin)
  mock.user = {
    findUnique: vi.fn(),
    update: vi.fn(),
  }

  return mock as PrismaClient
}
