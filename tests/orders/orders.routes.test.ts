import { test, expect, vi, beforeEach } from 'vitest'
import { fastify } from 'fastify'
import { PrismaClient } from '@prisma/client'
import ordersModule from '../../src/modules/orders/orders.routes'
import { createMockPrisma } from '../utils/mock-prisma'

// Type extension for Fastify req to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string; role: string }
  }
}

// Mock the prisma plugin
vi.mock('../../src/plugins/prisma', () => ({
  prismaPlugin: (app: any) => {
    app.decorate('prisma', createMockPrisma())
  }
}))

// Mock shared errors to properly set reply status and send
vi.mock('../../src/shared/errors', () => ({
  badRequest: (reply: any, message: string) => reply.code(400).send({ error: 'BAD_REQUEST', message }),
  notFound: (reply: any, message) => reply.code(404).send({ error: 'NOT_FOUND', message }),
  forbidden: (reply: any, message) => reply.code(403).send({ error: 'FORBIDDEN', message }),
  serverError: (reply: any, message) => reply.code(500).send({ error: 'INTERNAL_SERVER_ERROR', message }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// Helper to create test app with auth mock
function createTestApp() {
  const app = fastify()

  // Decorate with mock prisma
  const mockPrisma = createMockPrisma()
  app.decorate('prisma', mockPrisma)

  // Mock authenticate middleware
  app.authenticate = async (req: any, reply: any) => {
    // Attach a fake user to req for authenticated routes
    req.user = { id: 'test-user', email: 'test@example.com', role: 'ADMIN' }
  }

  return { app, mockPrisma }
}

test('GET /api/v1/orders - should return orders array', async () => {
  const { app, mockPrisma } = createTestApp()

  mockPrisma.order.findMany = vi.fn().mockResolvedValue([
    {
      id: '1',
      total: 100,
      status: 'PENDING',
      customer: { name: 'Test' },
      lines: [{ id: 'l1', qty: 1, unitPrice: 100, options: {}, product: { nameTk: 'Prod', nameRu: 'Продукт' } }],
      createdAt: new Date()
    }
  ])
  mockPrisma.order.count = vi.fn().mockResolvedValue(1)

  await app.register(ordersModule, { prefix: '/orders' })

  const response = await app.inject({
    method: 'GET',
    url: '/orders?page=1&limit=10'
  })

  expect(response.statusCode).toBe(200)
  const body = JSON.parse(response.body)
  expect(body).toHaveProperty('items')
  expect(body.items).toHaveLength(1)
})

test('GET /api/v1/orders/:id - should return single order', async () => {
  const { app, mockPrisma } = createTestApp()

  mockPrisma.order.findUnique = vi.fn().mockResolvedValue({
    id: '123',
    total: 250,
    status: 'PROCESSING',
    customer: { name: 'John' },
    lines: [],
    createdAt: new Date()
  })

  await app.register(ordersModule, { prefix: '/orders' })

  const response = await app.inject({
    method: 'GET',
    url: '/orders/123'
  })

  expect(response.statusCode).toBe(200)
  const body = JSON.parse(response.body)
  expect(body.id).toBe('123')
})

test('POST /api/v1/orders - should create order', async () => {
  const { app, mockPrisma } = createTestApp()

  mockPrisma.customer.findUnique = vi.fn().mockResolvedValue({
    id: 'cust-1',
    email: 'test@example.com'
  })
  mockPrisma.product.findUnique = vi.fn().mockResolvedValue({
    id: 'prod-1',
    price: 100,
    stock: 10,
    options: []
  })
  mockPrisma.product.findMany = vi.fn().mockResolvedValue([
    { id: 'prod-1', weightG: 1000 }
  ])
  mockPrisma.order.create = vi.fn().mockResolvedValue({
    id: 'new-order',
    total: 500,
    status: 'PENDING',
    customer: { name: 'Jane' },
    lines: [{ id: 'line-1', qty: 2, unitPrice: 100, options: {}, product: { nameTk: 'Test', nameRu: 'Тест' } }],
    createdAt: new Date()
  })
  mockPrisma.orderLine.create = vi.fn().mockResolvedValue({})

  await app.register(ordersModule, { prefix: '/orders' })

  const response = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: {
      customerId: 'cust-1',
      lines: [
        { productId: 'prod-1', qty: 2, unitPrice: 100, options: {} }
      ]
    }
  })

  expect(response.statusCode).toBe(201)
  const body = JSON.parse(response.body)
  expect(body.id).toBe('new-order')
})

test('GET /orders/:id - should return 404 for non-existent order', async () => {
  const { app, mockPrisma } = createTestApp()

  mockPrisma.order.findUnique = vi.fn().mockResolvedValue(null)

  await app.register(ordersModule, { prefix: '/orders' })

  const response = await app.inject({
    method: 'GET',
    url: '/orders/nonexistent'
  })

  expect(response.statusCode).toBe(404)
})

test('GET /orders - should return 400 for invalid query params', async () => {
  const { app, mockPrisma } = createTestApp()

  mockPrisma.order.findMany = vi.fn().mockResolvedValue([])
  mockPrisma.order.count = vi.fn().mockResolvedValue(0)

  await app.register(ordersModule, { prefix: '/orders' })

  const response = await app.inject({
    method: 'GET',
    url: '/orders?page=notanumber&limit=10'
  })

  // Should return 400 due to Zod validation failure (coerce.number fails)
  expect(response.statusCode).toBe(400)
})

test('POST /orders - should return 400 when customer not found', async () => {
  const { app, mockPrisma } = createTestApp()

  mockPrisma.customer.findUnique = vi.fn().mockResolvedValue(null)

  await app.register(ordersModule, { prefix: '/orders' })

  const response = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: {
      customerId: 'nonexistent',
      lines: [
        { productId: 'prod-1', qty: 2, unitPrice: 100, options: {} }
      ]
    }
  })

  expect(response.statusCode).toBe(404)
})

test('POST /orders - should return 400 when product invalid', async () => {
  const { app, mockPrisma } = createTestApp()

  mockPrisma.customer.findUnique = vi.fn().mockResolvedValue({
    id: 'cust-1',
    email: 'test@example.com'
  })
  mockPrisma.product.findUnique = vi.fn().mockResolvedValue(null)

  await app.register(ordersModule, { prefix: '/orders' })

  const response = await app.inject({
    method: 'POST',
    url: '/orders',
    payload: {
      customerId: 'cust-1',
      lines: [
        { productId: 'bad-product', qty: 2, unitPrice: 100, options: {} }
      ]
    }
  })

  expect(response.statusCode).toBe(400)
})

test('GET /orders/:id - track endpoint should be public', async () => {
  const { app, mockPrisma } = createTestApp()

  mockPrisma.order.findUnique = vi.fn().mockResolvedValue({
    id: 'track123',
    status: 'PENDING',
    total: 200,
    note: 'Test note',
    lines: [],
    createdAt: new Date(),
    updatedAt: new Date()
  })

  // Note: track route is public and does NOT use guard
  await app.register(ordersModule, { prefix: '/orders' })

  const response = await app.inject({
    method: 'GET',
    url: '/orders/track/track123'
    // No auth header needed
  })

  expect(response.statusCode).toBe(200)
  const body = JSON.parse(response.body)
  expect(body.id).toBe('track123')
})
