import type { FastifyInstance } from 'fastify'
import { AnalyticsQuerySchema } from '../../shared/types.js'
import { badRequest } from '../../shared/errors.js'
import { config } from '../../config.js'

function startOf(range: '7d' | '30d' | '12m'): Date {
  const d = new Date()
  if (range === '7d')  d.setDate(d.getDate() - 7)
  if (range === '30d') d.setDate(d.getDate() - 30)
  if (range === '12m') d.setFullYear(d.getFullYear() - 1)
  return d
}

export default async function analyticsRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  app.get('/', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const q = AnalyticsQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.message)
    const { range } = q.data
    const since = startOf(range)
    const duration = Date.now() - since.getTime()
    const prevStart = new Date(since.getTime() - duration)

    const [revCur, revPrev, ordCur, ordPrev, custCur, custPrev, topProducts, ordersForChart] = await Promise.all([
      app.prisma.order.aggregate({ where: { status: { not: 'CANCELLED' }, createdAt: { gte: since } }, _sum: { total: true } }),
      app.prisma.order.aggregate({ where: { status: { not: 'CANCELLED' }, createdAt: { gte: prevStart, lt: since } }, _sum: { total: true } }),
      app.prisma.order.count({ where: { createdAt: { gte: since } } }),
      app.prisma.order.count({ where: { createdAt: { gte: prevStart, lt: since } } }),
      app.prisma.customer.count({ where: { createdAt: { gte: since } } }),
      app.prisma.customer.count({ where: { createdAt: { gte: prevStart, lt: since } } }),
      app.prisma.product.findMany({ where: { status: 'ACTIVE' }, orderBy: { sold: 'desc' }, take: 5, include: { category: true } }),
      app.prisma.order.findMany({ where: { createdAt: { gte: since }, status: { not: 'CANCELLED' } }, select: { total: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
    ])

    const chg = (cur: number, pre: number) => pre === 0 ? 0 : Math.round(((cur - pre) / pre) * 1000) / 10
    const curRevenue = Number(revCur._sum.total ?? 0)
    const prevRevenue = Number(revPrev._sum.total ?? 0)
    const aov = ordCur > 0 ? curRevenue / ordCur : 0
    const prevAov = ordPrev > 0 ? prevRevenue / ordPrev : 0

    // Build time-series buckets
    const now = new Date()
    const buckets: { label: string; revenue: number; orders: number }[] = []

    if (range === '7d') {
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now); day.setDate(day.getDate() - i)
        const label = day.toLocaleDateString('en-US', { weekday: 'short' })
        const inB = ordersForChart.filter(o => {
          const d = new Date(o.createdAt)
          return d.getDate() === day.getDate() && d.getMonth() === day.getMonth()
        })
        buckets.push({ label, revenue: inB.reduce((s, o) => s + Number(o.total), 0), orders: inB.length })
      }
    } else if (range === '30d') {
      for (let i = 9; i >= 0; i--) {
        const end = new Date(now); end.setDate(end.getDate() - i * 3)
        const start = new Date(end); start.setDate(start.getDate() - 3)
        const label = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const inB = ordersForChart.filter(o => new Date(o.createdAt) >= start && new Date(o.createdAt) < end)
        buckets.push({ label, revenue: inB.reduce((s, o) => s + Number(o.total), 0), orders: inB.length })
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now); d.setMonth(d.getMonth() - i)
        const label = d.toLocaleDateString('en-US', { month: 'short' })
        const inB = ordersForChart.filter(o => {
          const od = new Date(o.createdAt)
          return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear()
        })
        buckets.push({ label, revenue: inB.reduce((s, o) => s + Number(o.total), 0), orders: inB.length })
      }
    }

    return reply.send({
      kpis: {
        revenue:   { value: curRevenue,                          change: chg(curRevenue, prevRevenue) },
        orders:    { value: ordCur,                              change: chg(ordCur, ordPrev)         },
        customers: { value: custCur,                             change: chg(custCur, custPrev)       },
        aov:       { value: Math.round(aov * 100) / 100,        change: chg(aov, prevAov)            },
      },
      timeSeries: buckets,
      topProducts,
    })
  })
}