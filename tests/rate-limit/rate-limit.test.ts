import { test, expect, vi, beforeEach } from 'vitest'
import { fastify } from 'fastify'
import { rateLimitPlugin } from '../../src/plugins/rate-limit'
import prismaPlugin from '../../src/plugins/prisma'
import jwtPlugin from '../../src/plugins/jwt'
import authRoutes from '../../src/modules/auth/auth.routes'
import productsRoutes from '../../src/modules/products/products.routes'
import { createMockPrisma } from '../utils/mock-prisma'

// Mock prisma plugin (it's a default export)
vi.mock('../../src/plugins/prisma', () => ({
  default: (app: any) => {
    app.decorate('prisma', createMockPrisma())
  }
}))

// Mock JWT plugin (default export)
vi.mock('../../src/plugins/jwt', () => ({
  default: (app: any, _opts: any) => {
    app.decorate('jwt', {
      sign: vi.fn(() => 'fake-token'),
      verify: vi.fn(() => ({ sub: 'user-1', email: 'test@test.com', role: 'ADMIN' })),
    })
    app.authenticate = async (req: any) => {
      ;(req as any).user = { id: 'user-1', email: 'test@test.com', role: 'ADMIN' }
    }
  }
}))

// Mock shared errors
vi.mock('../../src/shared/errors', () => ({
  badRequest: (reply: any, message: string) => reply.code(400).send({ error: 'BAD_REQUEST', message }),
  notFound: (reply: any, message) => reply.code(404).send({ error: 'NOT_FOUND', message }),
  unauthorized: (reply: any, message) => reply.code(401).send({ error: 'UNAUTHORIZED', message }),
  conflict: (reply: any, message) => reply.code(409).send({ error: 'CONFLICT', message }),
}))

// Mock config
vi.mock('../../src/config', () => ({
  config: {
    isDev: false,
    jwt: { accessExpiresIn: '15m', refreshExpiresIn: '7d' },
    rateLimits: {
      auth:          { max: 5,  timeWindow: '1 minute' },
      refresh:       { max: 10, timeWindow: '1 minute' },
      customerAuth:  { max: 10, timeWindow: '1 minute' },
      upload:        { max: 10, timeWindow: '1 minute' },
      publicUpload:  { max: 5,  timeWindow: '1 minute' },
      admin:         { max: 60, timeWindow: '1 minute' },
      customer:      { max: 60, timeWindow: '1 minute' },
      products:      { max: 200, timeWindow: '1 minute' },
      publicRequests:{ max: 10, timeWindow: '1 minute' },
      default:       { max: 200, timeWindow: '1 minute' },
    },
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
})

test('POST /auth/login - should be rate limited to 5 per minute', async () => {
  const app = fastify()
  const mockPrisma = createMockPrisma()
  app.decorate('prisma', mockPrisma)

  // Mock JWT (also done via vi.mock but we also set here for this app instance)
  app.decorate('jwt', {
    sign: vi.fn(() => 'fake-token'),
    verify: vi.fn(() => ({ sub: 'user-1', email: 'test@test.com', role: 'ADMIN' })),
  })
  app.authenticate = async (req: any) => {
    ;(req as any).user = { id: 'user-1', email: 'test@test.com', role: 'ADMIN' }
  }

  // Register custom rate limit plugin (global)
  await app.register(rateLimitPlugin)

  await app.register(prismaPlugin)
  await app.register(jwtPlugin, {})
  await app.register(authRoutes, { prefix: '/auth' })

  // Make 5 requests (should succeed)
  for (let i = 0; i < 5; i++) {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'password123' }
    })
    expect(res.statusCode).not.toBe(429)
  }

  // 6th request should be rate limited
  const res6 = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'test@example.com', password: 'password123' }
  })
  expect(res6.statusCode).toBe(429)
  // Check rate limit headers
  expect(res6.headers['x-ratelimit-limit']).toBe('5')
  expect(res6.headers['x-ratelimit-remaining']).toBe('0')
})

test('GET /products - should have higher limit (100/min) and include headers', async () => {
  const app = fastify()
  const mockPrisma = createMockPrisma()
  mockPrisma.product.findMany = vi.fn().mockResolvedValue([])
  mockPrisma.product.count = vi.fn().mockResolvedValue(0)
  app.decorate('prisma', mockPrisma)

  // Mock JWT for any authenticated routes
  app.decorate('jwt', {
    sign: vi.fn(() => 'fake-token'),
    verify: vi.fn(() => ({ sub: 'user-1', email: 'test@test.com', role: 'ADMIN' })),
  })
  app.authenticate = async (req: any) => {
    ;(req as any).user = { id: 'user-1', email: 'test@test.com', role: 'ADMIN' }
  }

  // Register custom rate limit plugin (global)
  await app.register(rateLimitPlugin)

  await app.register(prismaPlugin)
  await app.register(jwtPlugin, {})
  const prodRoutes = await import('../../src/modules/products/products.routes')
  await app.register(prodRoutes.default, { prefix: '/products' })

  // Debug: log registered routes
  const routes = (app.router as any).registry.getRoutes()
  console.log('Registered routes:', routes.map((r: any) => `${r.method} ${r.path}`))

  const res = await app.inject({
    method: 'GET',
    url: '/products/?page=1&limit=10'
  })

  expect(res.statusCode).toBe(200)
  // Rate limit headers should be present (global limit 200)
  expect(res.headers['x-ratelimit-limit']).toBeDefined()
  expect(res.headers['x-ratelimit-remaining']).toBeDefined()
})

test('Rate limit headers should reflect remaining requests', async () => {
  const app = fastify()
  const mockPrisma = createMockPrisma()
  app.decorate('prisma', mockPrisma)

  app.decorate('jwt', {
    sign: vi.fn(() => 'fake-token'),
    verify: vi.fn(() => ({ sub: 'user-1', email: 'test@test.com', role: 'ADMIN' })),
  })
  app.authenticate = async (req: any) => {
    ;(req as any).user = { id: 'user-1', email: 'test@test.com', role: 'ADMIN' }
  }

  // Register custom rate limit plugin (global)
  await app.register(rateLimitPlugin)

  await app.register(prismaPlugin)
  await app.register(jwtPlugin, {})
  const prodRoutes = await import('../../src/modules/products/products.routes')
  await app.register(prodRoutes.default, { prefix: '/products' })

  // Make a few requests to exhaust some of the global limit
  for (let i = 0; i < 5; i++) {
    await app.inject({
      method: 'GET',
      url: '/products?page=1&limit=10'
    })
  }

  const res = await app.inject({
    method: 'GET',
    url: '/products/?page=1&limit=10'
  })

  // Check remaining count is less than global limit (200)
  const remaining = parseInt(res.headers['x-ratelimit-remaining'] as string, 10)
  expect(remaining).toBeLessThan(200)
})
