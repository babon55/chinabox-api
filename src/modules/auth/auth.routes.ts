import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { config } from '../../config.js'
import { LoginSchema, RefreshSchema, PasswordChangeSchema } from '../../shared/types.js'
import { badRequest, unauthorized, notFound } from '../../shared/errors.js'
import bcrypt from 'bcrypt'

async function hashPw(pw: string) {
  return bcrypt.hash(pw, 10)
}

// ✅ FIX 9: parse TTL string from config ('7d', '15m') instead of hardcoding ms
function parseTtlMs(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/)
  if (!match) return 7 * 24 * 60 * 60 * 1000
  const v = parseInt(match[1], 10)
  switch (match[2]) {
    case 's': return v * 1000
    case 'm': return v * 60 * 1000
    case 'h': return v * 60 * 60 * 1000
    case 'd': return v * 24 * 60 * 60 * 1000
    default:  return 7 * 24 * 60 * 60 * 1000
  }
}

// ✅ FIX 11: proper Zod schema for PATCH /me — was raw body with manual allowlist
const UpdateMeSchema = z.object({
  name:     z.string().min(1).max(100).optional(),
  phone:    z.string().max(30).optional().nullable(),
  avatar:   z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  langPref: z.string().max(10).optional(),
})

export default async function authRoutes(app: FastifyInstance) {

  // POST /auth/login
  app.post('/login', {
    rateLimit: { max: config.rateLimits.auth.max, timeWindow: config.rateLimits.auth.timeWindow }
  }, async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { email, password } = parsed.data

    const user = await app.prisma.user.findUnique({ where: { email } })
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return unauthorized(reply, 'Invalid email or password')
    }

    const payload      = { sub: user.id, email: user.email, role: user.role }
    const accessToken  = app.jwt.sign(payload, { expiresIn: config.jwt.accessExpiresIn })
    const refreshToken = app.jwt.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: config.jwt.refreshExpiresIn, secret: config.jwt.refreshSecret }
    )

    // ✅ FIX 9: TTL derived from config, not hardcoded
    const expiresAt = new Date(Date.now() + parseTtlMs(config.jwt.refreshExpiresIn))
    await app.prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    })

    return reply.code(200).send({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    })
  })

  // POST /auth/refresh
  app.post('/refresh', {
    rateLimit: { max: config.rateLimits.refresh.max, timeWindow: config.rateLimits.refresh.timeWindow }
  }, async (req, reply) => {
    const parsed = RefreshSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, 'refreshToken required')
    const { refreshToken } = parsed.data

    let payload: { sub: string; email: string; role: string }
    try {
      payload = app.jwt.verify(refreshToken, { secret: config.jwt.refreshSecret }) as typeof payload
    } catch {
      return unauthorized(reply, 'Invalid refresh token')
    }

    const stored = await app.prisma.refreshToken.findUnique({ where: { token: refreshToken } })
    if (!stored || stored.expiresAt < new Date()) {
      return unauthorized(reply, 'Refresh token expired or revoked')
    }

    await app.prisma.refreshToken.delete({ where: { token: refreshToken } })

    const newAccessToken  = app.jwt.sign(
      { sub: payload.sub, email: payload.email, role: payload.role },
      { expiresIn: config.jwt.accessExpiresIn }
    )
    const newRefreshToken = app.jwt.sign(
      { sub: payload.sub, email: payload.email, role: payload.role, type: 'refresh' },
      { expiresIn: config.jwt.refreshExpiresIn, secret: config.jwt.refreshSecret }
    )

    // ✅ FIX 9: TTL derived from config, not hardcoded
    const expiresAt = new Date(Date.now() + parseTtlMs(config.jwt.refreshExpiresIn))
    await app.prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: stored.userId, expiresAt },
    })

    return reply.code(200).send({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  })

  // POST /auth/logout
  app.post('/logout', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const parsed = RefreshSchema.safeParse(req.body)
    if (parsed.success) {
      await app.prisma.refreshToken.deleteMany({ where: { token: parsed.data.refreshToken } })
    }
    return reply.code(204).send()
  })

  // GET /auth/me
  app.get('/me', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const user = await app.prisma.user.findUnique({
      where:  { id: (req.user as any).sub },
      select: { id: true, name: true, email: true, role: true, avatar: true, phone: true, timezone: true, langPref: true },
    })
    if (!user) return notFound(reply, 'User')
    return reply.code(200).send(user)
  })

  // PATCH /auth/me
  app.patch('/me', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    // ✅ FIX 11: was raw body with manual Object.fromEntries allowlist filter —
    //    no type coercion, no length limits, no format validation.
    //    Now uses Zod: consistent with every other endpoint in the project.
    const parsed = UpdateMeSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)

    const user = await app.prisma.user.update({
      where:  { id: (req.user as any).sub },
      data:   parsed.data,
      select: { id: true, name: true, email: true, role: true, avatar: true, phone: true, timezone: true, langPref: true },
    })
    return reply.code(200).send(user)
  })

  // POST /auth/change-password
  app.post('/change-password', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const parsed = PasswordChangeSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { currentPassword, newPassword } = parsed.data

    const user = await app.prisma.user.findUnique({ where: { id: (req.user as any).sub } })
    if (!user) return notFound(reply, 'User')
    if (!await bcrypt.compare(currentPassword, user.passwordHash)) {
      return unauthorized(reply, 'Current password is incorrect')
    }

    await app.prisma.user.update({
      where: { id: (req.user as any).sub },
      data:  { passwordHash: await hashPw(newPassword) },
    })

    // Invalidate all sessions on password change
    await app.prisma.refreshToken.deleteMany({ where: { userId: (req.user as any).sub } })

    return reply.code(200).send({ message: 'Password changed successfully' })
  })
}