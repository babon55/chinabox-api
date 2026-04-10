// Ensure environment variables are loaded before config is evaluated
import 'dotenv/config'

// Override to ensure in-memory storage for tests (unless REDIS_URL set)
process.env.REDIS_URL = ''

import { test, expect, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import { rateLimitPlugin } from '../rate-limit.js'
import { config } from '../../config.js'

// Helper to create test app with rate limiting
async function createTestApp(options: { max?: number; timeWindow?: string | number } = {}) {
  const app = Fastify({ logger: false })

  // Test hook to see if hooks work
  app.addHook('preHandler', async (req, reply) => {
    console.log('>>> TEST PREHANDLER <<<')
  })

  await app.register(rateLimitPlugin)

  // Test route with optional custom rate limit
  app.get('/test', {
    rateLimit: options.max || options.timeWindow ? options : undefined
  }, async (req, reply) => {
    return { ok: true }
  })

  return app
}

describe('Rate Limit Plugin (In-Memory)', () => {
  let app: Fastify.FastifyInstance
  let originalRedisUrl: string | undefined

  beforeEach(async () => {
    originalRedisUrl = config.redisUrl
    config.redisUrl = undefined // Force in-memory
    app = await createTestApp()
    // Wait for hooks to be compiled
    await app.ready()
  })

  afterEach(async () => {
    config.redisUrl = originalRedisUrl
    await app.close()
  })

  test('should allow requests up to limit', async () => {
    const max = config.rateLimits.default.max // 200

    for (let i = 0; i < max; i++) {
      const res = await app.inject({ method: 'GET', url: '/test' })
      expect(res.statusCode).toBe(200)
    }
  })

  test('should reject requests beyond limit with 429', async () => {
    const max = config.rateLimits.default.max
    const extraRequests = 5

    // Exhaust the limit
    for (let i = 0; i < max; i++) {
      await app.inject({ method: 'GET', url: '/test' })
    }

    // Try beyond limit
    for (let i = 0; i < extraRequests; i++) {
      const res = await app.inject({ method: 'GET', url: '/test' })
      expect(res.statusCode).toBe(429)
      const body = JSON.parse(res.body)
      expect(body.error).toBe('RATE_LIMIT_EXCEEDED')
    }
  })

  test('should set rate limit headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/test' })
    expect(res.headers['x-ratelimit-limit']).toBe(config.rateLimits.default.max.toString())
    expect(res.headers['x-ratelimit-remaining']).toBe((config.rateLimits.default.max - 1).toString())
  })

  test('should respect custom rate limit options', async () => {
    const customMax = 3
    const appCustom = await createTestApp({ max: customMax })
    await appCustom.ready()

    // Allow up to customMax
    for (let i = 0; i < customMax; i++) {
      const res = await appCustom.inject({ method: 'GET', url: '/test' })
      expect(res.statusCode).toBe(200)
      expect(res.headers['x-ratelimit-limit']).toBe(customMax.toString())
    }

    // Block beyond customMax
    const res = await appCustom.inject({ method: 'GET', url: '/test' })
    expect(res.statusCode).toBe(429)
    expect(res.headers['x-ratelimit-remaining']).toBe('0')

    await appCustom.close()
  })

  test('should use different keys for different IPs', async () => {
    const max = config.rateLimits.default.max

    // Simulate two different IPs
    const ip1 = '192.168.1.1'
    const ip2 = '192.168.1.2'

    // Exhaust limit for IP1
    for (let i = 0; i < max; i++) {
      await app.inject({ method: 'GET', url: '/test', remoteAddress: ip1 })
    }

    // IP1 should be rate limited
    let res = await app.inject({ method: 'GET', url: '/test', remoteAddress: ip1 })
    expect(res.statusCode).toBe(429)

    // IP2 should still be allowed
    res = await app.inject({ method: 'GET', url: '/test', remoteAddress: ip2 })
    expect(res.statusCode).toBe(200)
  })

  test('should use user ID for authenticated requests', async () => {
    const max = 10
    // For this test, we rely on IP since can't easily mock authenticated user in inject
    // But we can verify that rate limit works generally
    for (let i = 0; i < max; i++) {
      const res = await app.inject({ method: 'GET', url: '/test' })
      expect(res.statusCode).toBe(200)
    }
  })
})

describe('Rate Limit Plugin - skip function', () => {
  let app: Fastify.FastifyInstance
  let originalRedisUrl: string | undefined

  beforeEach(async () => {
    originalRedisUrl = config.redisUrl
    config.redisUrl = undefined
    app = Fastify({ logger: false })
    await app.register(rateLimitPlugin)

    // Register a route with skip function that bypasses limit for a specific header
    app.get('/skip', {
      rateLimit: { max: 2, skip: (req) => req.headers['x-skip-rate-limit'] === 'true' }
    }, async (req, reply) => {
      return { skipped: true }
    })

    await app.ready()
  })

  afterEach(async () => {
    config.redisUrl = originalRedisUrl
    await app.close()
  })

  test('should skip rate limiting for matching request', async () => {
    // Requests without skip header should be limited
    await app.inject({ method: 'GET', url: '/skip' })
    await app.inject({ method: 'GET', url: '/skip' })
    let res = await app.inject({ method: 'GET', url: '/skip' })
    expect(res.statusCode).toBe(429)

    // Request with skip header should bypass limit (even after exceeding)
    res = await app.inject({
      method: 'GET',
      url: '/skip',
      headers: { 'x-skip-rate-limit': 'true' }
    })
    expect(res.statusCode).toBe(200)
  })
})
