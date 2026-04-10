import type { FastifyInstance } from 'fastify'
import { createHash } from 'crypto'
import { config } from '../../config.js'
import { LoginSchema, RefreshSchema, PasswordChangeSchema } from '../../shared/types.js'
import { badRequest, unauthorized, notFound } from '../../shared/errors.js'

function hashPw(pw: string) {
  return createHash('sha256').update(pw).digest('hex')
}

export default async function authRoutes(app: FastifyInstance) {

  // POST /api/v1/auth/login - limit to prevent brute force
  app.post('/login', {
    rateLimit: { max: config.rateLimits.auth.max, timeWindow: config.rateLimits.auth.timeWindow }
  }, async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { email, password } = parsed.data

    const user = await app.prisma.user.findUnique({ where: { email } })
    if (!user || user.passwordHash !== hashPw(password)) {
      return unauthorized(reply, 'Invalid email or password')
    }

    const payload = { sub: user.id, email: user.email, role: user.role }
    const accessToken  = app.jwt.sign(payload, { expiresIn: config.jwt.accessExpiresIn })
    const refreshToken = app.jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: config.jwt.refreshExpiresIn })

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await app.prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    })

    return reply.code(200).send({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    })
  })

  // POST /api/v1/auth/refresh - limit to prevent abuse
  app.post('/refresh', {
    rateLimit: { max: config.rateLimits.refresh.max, timeWindow: config.rateLimits.refresh.timeWindow }
  }, async (req, reply) => {
    const parsed = RefreshSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, 'refreshToken required')
    const { refreshToken } = parsed.data

    let payload: { sub: string; email: string; role: string }
    try {
      payload = app.jwt.verify(refreshToken) as typeof payload
    } catch {
      return unauthorized(reply, 'Invalid refresh token')
    }

    const stored = await app.prisma.refreshToken.findUnique({ where: { token: refreshToken } })
    if (!stored || stored.expiresAt < new Date()) {
      return unauthorized(reply, 'Refresh token expired or revoked')
    }

    await app.prisma.refreshToken.delete({ where: { token: refreshToken } })

    const newAccessToken  = app.jwt.sign({ sub: payload.sub, email: payload.email, role: payload.role }, { expiresIn: config.jwt.accessExpiresIn })
    const newRefreshToken = app.jwt.sign({ sub: payload.sub, email: payload.email, role: payload.role, type: 'refresh' }, { expiresIn: config.jwt.refreshExpiresIn })

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await app.prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: stored.userId, expiresAt },
    })

    return reply.code(200).send({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  })

  // POST /api/v1/auth/logout
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

  // GET /api/v1/auth/me
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

  // PATCH /api/v1/auth/me
  app.patch('/me', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const body    = req.body as Record<string, unknown>
    const allowed = ['name', 'phone', 'avatar', 'timezone', 'langPref']
    const data    = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))
    const user    = await app.prisma.user.update({ where: { id: (req.user as any).sub }, data })
    return reply.code(200).send(user)
  })

  // POST /api/v1/auth/change-password
  app.post('/change-password', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const parsed = PasswordChangeSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { currentPassword, newPassword } = parsed.data

    const user = await app.prisma.user.findUnique({ where: { id: (req.user as any).sub } })
    if (!user) return notFound(reply, 'User')
    if (user.passwordHash !== hashPw(currentPassword)) {
      return unauthorized(reply, 'Current password is incorrect')
    }

    await app.prisma.user.update({
      where: { id: (req.user as any).sub },
      data:  { passwordHash: hashPw(newPassword) },
    })
    await app.prisma.refreshToken.deleteMany({ where: { userId: (req.user as any).sub } })

    return reply.code(200).send({ message: 'Password changed successfully' })
  })
}