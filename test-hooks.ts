import Fastify from 'fastify'
import 'dotenv/config'

process.env.JWT_ACCESS_SECRET = 'test'
process.env.JWT_REFRESH_SECRET = 'test'
process.env.DATABASE_URL = 'postgresql://test'

const app = Fastify({ logger: false })

// Add global preHandler hook
app.addHook('preHandler', async (req, reply) => {
  console.log('GLOBAL PREHANDLER CALLED for', req.url)
  reply.header('x-test', 'value')
})

app.get('/test', async (req, reply) => {
  return { ok: true }
})

await app.ready()

const res = await app.inject({ method: 'GET', url: '/test' })
console.log('Status:', res.statusCode)
console.log('Headers:', res.headers)
console.log('Body:', res.body)

await app.close()
