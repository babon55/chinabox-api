import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import Redis from 'ioredis'
import { config } from '../config.js'

interface RateLimitOptions {
  max: number
  timeWindow: string | number
  skip?: (req: FastifyRequest) => boolean
}

// Storage abstraction
interface RateLimitStorage {
  incr(key: string, ttlMs: number): Promise<number>
  close?(): Promise<void>
}

// In-memory storage (development/single-instance)
class InMemoryStorage implements RateLimitStorage {
  private store = new Map<string, { count: number; resetAt: number }>()

  async incr(key: string, ttlMs: number): Promise<number> {
    const now = Date.now()
    const record = this.store.get(key)

    if (!record || now > record.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + ttlMs })
      return 1
    }

    record.count++
    return record.count
  }

  async close(): Promise<void> {
    this.store.clear()
  }
}

// Redis storage (production, multi-instance)
class RedisStorage implements RateLimitStorage {
  private client: Redis.Redis
  private prefix: string

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl)
    this.prefix = 'ratelimit:'
    this.client.on('error', (err) => {
      console.error('Redis rate limit storage error:', err)
    })
  }

  async incr(key: string, ttlMs: number): Promise<number> {
    const fullKey = this.prefix + key
    // INCR is atomic in Redis
    const count = await this.client.incr(fullKey)
    // Set TTL on first increment (when count becomes 1)
    if (count === 1) {
      await this.client.expire(fullKey, Math.ceil(ttlMs / 1000))
    }
    return count
  }

  async close(): Promise<void> {
    await this.client.quit()
  }
}

function parseTimeWindow(window: string | number): number {
  if (typeof window === 'number') return window
  const match = window.match(/(\d+)\s*(second|minute|hour)s?/i)
  if (!match) return 60_000 // default 1 minute
  const value = parseInt(match[1], 10)
  const unit = match[2].toLowerCase()
  switch (unit) {
    case 'second': return value * 1000
    case 'minute': return value * 60 * 1000
    case 'hour': return value * 60 * 60 * 1000
    default: return 60_000
  }
}

export async function rateLimitPlugin(app: FastifyInstance) {
  console.log('!!! rateLimitPlugin invoked on app') // Debug
  // Initialize storage for this app instance (not shared)
  let storage: RateLimitStorage

  if (config.redisUrl) {
    try {
      storage = new RedisStorage(config.redisUrl)
      app.log.info('Rate limiting using Redis storage')
    } catch (err) {
      app.log.warn('Failed to initialize Redis for rate limiting, falling back to in-memory:', err)
      storage = new InMemoryStorage()
    }
  } else {
    storage = new InMemoryStorage()
  }

  // Clean up storage when app closes
  app.addHook('onClose', async () => {
    await storage.close?.()
  })

  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    // Get route-specific rate limit options from reply.routeOptions
    const routeOptions = (reply as any).routeOptions as { rateLimit?: RateLimitOptions | false } | undefined
    let rlOptions = routeOptions?.rateLimit

    // Debug: always log for testing
    console.log('[RateLimit] Hook called. routeOptions:', routeOptions, 'rlOptions:', rlOptions, 'path:', req.url)

    // If rate limiting is explicitly disabled, skip
    if (rlOptions === false) {
      return
    }

    // If no route-specific options, use default
    if (!rlOptions) {
      rlOptions = {
        max: config.rateLimits.default.max,
        timeWindow: config.rateLimits.default.timeWindow,
      }
    }

    // Check skip function if provided
    if (rlOptions.skip && typeof rlOptions.skip === 'function' && rlOptions.skip(req)) {
      return
    }

    // Generate key: use user ID if authenticated, otherwise IP
    const key = (req.user as any)?.id ?? (req.ip as string)

    // Parse time window to milliseconds
    const windowMs = parseTimeWindow(rlOptions.timeWindow)

    try {
      const count = await storage.incr(key, windowMs)

      if (count > rlOptions.max) {
        // Rate limit exceeded
        reply.header('x-ratelimit-limit', rlOptions.max.toString())
        reply.header('x-ratelimit-remaining', '0')
        reply.code(429).send({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.'
        })
        return reply
      }

      // Within limit
      reply.header('x-ratelimit-limit', rlOptions.max.toString())
      reply.header('x-ratelimit-remaining', (rlOptions.max - count).toString())
    } catch (err) {
      // Redis or storage error: log and allow request (fail open)
      app.log.error('Rate limit storage error:', err)
      // Optionally could skip rate limiting for this request
      // Still set headers to indicate rate limiting would be active if storage was working
      reply.header('x-ratelimit-limit', rlOptions.max.toString())
      reply.header('x-ratelimit-remaining', '?')
    }
  })
}
