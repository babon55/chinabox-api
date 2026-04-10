import type { FastifyInstance } from 'fastify'
import { StoreSettingsSchema } from '../../shared/types.js'
import { badRequest } from '../../shared/errors.js'
import { config } from '../../config.js'

export default async function settingsRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  app.get('/store', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (_req, reply) => {
    const settings = await app.prisma.storeSettings.upsert({
      where:  { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    })
    return reply.send(settings)
  })

  app.patch('/store', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const parsed = StoreSettingsSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const settings = await app.prisma.storeSettings.upsert({
      where:  { id: 'singleton' },
      update: parsed.data,
      create: { id: 'singleton', ...parsed.data },
    })
    return reply.send(settings)
  })
}