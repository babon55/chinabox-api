import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Redis } from 'ioredis'
import { config } from '../config.js'

interface RateLimitOptions {
  max: number
  timeWindow: string | number
  skip?: (req: FastifyRequest) => boolean
}

interface RateLimitStorage {
  incr(key: string, ttlMs: number): Promise<number>
  close?(): Promise<void>
}

// ── In-memory storage (development / single-instance) ────────────────────────
class InMemoryStorage implements RateLimitStorage {
  private store = new Map<string, { count: number; resetAt: number }>()
  private cleanupTimer: ReturnType<typeof setInterval>

  constructor() {
    // ✅ FIX 10: sweep expired entries every 5 minutes so the Map doesn't
    //    grow forever — one entry per unique IP/user ID was never removed.
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, record] of this.store) {
        if (now > record.resetAt) this.store.delete(key)
      }
    }, 5 * 60 * 1000)

    // Don't let the timer prevent the process from exiting cleanly
    this.cleanupTimer.unref()
  }

  async incr(key: string, ttlMs: number): Promise<number> {
    const now    = Date.now()
    const record = this.store.get(key)

    if (!record || now > record.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + ttlMs })
      return 1
    }

    record.count++
    return record.count
  }

  async close(): Promise<void> {
    clearInterval(this.cleanupTimer)
    this.store.clear()
  }
}

// ── Redis storage (production, multi-instance) ────────────────────────────────
class RedisStorage implements RateLimitStorage {
  private client: Redis
  private prefix = 'ratelimit:'

  // ✅ FIX 8: Lua script makes INCR + EXPIRE a single atomic operation.
  //    Before: two separate commands — if the process crashed between them,
  //    the key had no TTL and that IP was permanently rate-limited.
  //    Now: both happen in one round-trip, guaranteed atomic by Redis.
  private static readonly LUA_INCR = `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
      redis.call('PEXPIRE', KEYS[1], ARGV[1])
    end
    return current
  `

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl)
    this.client.on('error', (err) => {
      console.error('Redis rate limit storage error:', err)
    })
  }

  async incr(key: string, ttlMs: number): Promise<number> {
    const fullKey = this.prefix + key
    // eval() sends the Lua script + args in one command — fully atomic
    const result = await this.client.eval(
      RedisStorage.LUA_INCR,
      1,          // number of keys
      fullKey,    // KEYS[1]
      ttlMs,      // ARGV[1] — millisecond TTL via PEXPIRE
    )
    return result as number
  }

  async close(): Promise<void> {
    await this.client.quit()
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseTimeWindow(window: string | number): number {
  if (typeof window === 'number') return window
  const match = window.match(/(\d+)\s*(second|minute|hour)s?/i)
  if (!match) return 60_000
  const value = parseInt(match[1], 10)
  switch (match[2].toLowerCase()) {
    case 'second': return value * 1_000
    case 'minute': return value * 60_000
    case 'hour':   return value * 3_600_000
    default:       return 60_000
  }
}

// ── Plugin ────────────────────────────────────────────────────────────────────
export async function rateLimitPlugin(app: FastifyInstance) {
  let storage: RateLimitStorage

  if (config.redisUrl) {
    try {
      storage = new RedisStorage(config.redisUrl)
      app.log.info('Rate limiting using Redis storage')
    } catch (err) {
      app.log.warn({ err }, 'Failed to initialize Redis for rate limiting, falling back to in-memory')
      storage = new InMemoryStorage()
    }
  } else {
    storage = new InMemoryStorage()
  }

  app.addHook('onClose', async () => {
    await storage.close?.()
  })

  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const routeOptions = (reply as any).routeOptions as { rateLimit?: RateLimitOptions | false } | undefined
    let rlOptions = routeOptions?.rateLimit

    if (rlOptions === false) return

    if (!rlOptions) {
      rlOptions = {
        max:        config.rateLimits.default.max,
        timeWindow: config.rateLimits.default.timeWindow,
      }
    }

    if (rlOptions.skip && rlOptions.skip(req)) return

    const key      = (req.user as any)?.id ?? req.ip
    const windowMs = parseTimeWindow(rlOptions.timeWindow)

    try {
      const count = await storage.incr(key, windowMs)

      reply.header('x-ratelimit-limit',     rlOptions.max.toString())
      reply.header('x-ratelimit-remaining', Math.max(0, rlOptions.max - count).toString())

      if (count > rlOptions.max) {
        reply.code(429).send({
          error:   'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.',
        })
        return reply
      }
    } catch (err) {
      // Storage error: log and fail open — never block legitimate requests
      app.log.error({ err }, 'Rate limit storage error')
      reply.header('x-ratelimit-limit',     rlOptions.max.toString())
      reply.header('x-ratelimit-remaining', '?')
    }
  })
}