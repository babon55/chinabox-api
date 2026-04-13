import fp from 'fastify-plugin'
import { fastifyOauth2 } from '@fastify/oauth2'

export default fp(async (fastify) => {
  fastify.register(fastifyOauth2, {
    name: 'googleOAuth2',
    scope: ['profile', 'email'],
    credentials: {
      client: {
        id:     process.env.GOOGLE_CLIENT_ID!,
        secret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      auth: {
        authorizeHost: 'https://accounts.google.com',
        authorizePath: '/o/oauth2/auth',
        tokenHost:     'https://oauth2.googleapis.com',
        tokenPath:     '/token',
      },
    },
    startRedirectPath: '/auth/google',
    callbackUri: process.env.GOOGLE_CALLBACK_URL!,
  })
})