import { FastifyInstance } from 'fastify'

export default async function googleAuthRoutes(fastify: FastifyInstance) {
  fastify.get('/auth/google/callback', async (request, reply) => {
    try {
      const token = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)

      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.token.access_token}` },
      })
      const googleUser = await res.json() as {
        id: string; email: string; name: string; picture: string
      }

      let user = await fastify.prisma.customer.findUnique({
        where: { googleId: googleUser.id },
      })

      if (!user) {
        user = await fastify.prisma.customer.findUnique({
          where: { email: googleUser.email },
        })

        if (user) {
          user = await fastify.prisma.customer.update({
            where: { id: user.id },
            data: { googleId: googleUser.id },
          })
        } else {
          user = await fastify.prisma.customer.create({
            data: {
              email:        googleUser.email,
              name:         googleUser.name,
              googleId:     googleUser.id,
              passwordHash: null,
            },
          })
        }
      }

      const payload = { sub: user.id, email: user.email, name: user.name, role: 'CUSTOMER' }

      // ✅ Generate both tokens — same as regular login
      const accessToken  = fastify.jwt.sign(
        { ...payload, type: 'access' },
        { expiresIn: '15m' }   // short-lived
      )
      const refreshToken = fastify.jwt.sign(
        { ...payload, type: 'refresh' },
        { expiresIn: '30d' }   // long-lived
      )

      return reply.redirect(
        `${process.env.CLIENT_URL}/auth/google/success?token=${accessToken}&refresh=${refreshToken}`
      )
    } catch (err) {
      fastify.log.error(err)
      return reply.redirect(`${process.env.CLIENT_URL}/signin?error=google_failed`)
    }
  })
}