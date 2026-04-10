import type { RateLimitPluginOptions } from '@fastify/rate-limit'

declare module 'fastify' {
  interface RouteShorthandOptions {
    rateLimit?: RateLimitPluginOptions | false
  }
}
