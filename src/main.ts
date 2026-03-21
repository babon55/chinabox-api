import 'dotenv/config'
import { buildApp } from './app.js'
import { config   } from './config.js'

const app = await buildApp()

try {
  await app.listen({ port: config.port, host: config.host })
  console.log(`🚀  silkshop-api running on http://localhost:${config.port}`)
  console.log(`📋  API: http://localhost:${config.port}/api/v1`)
  console.log(`❤️   Health: http://localhost:${config.port}/health`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}