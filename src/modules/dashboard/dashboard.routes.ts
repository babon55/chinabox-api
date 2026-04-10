import type { FastifyInstance } from 'fastify'
import { config } from '../../config.js'

export default async function dashboardRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  app.get('/', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (_req, reply) => {
    const [totalRevenue, totalOrders, totalCustomers, totalProducts, recentOrders, topProducts, ordersByStatus] = await Promise.all([
      app.prisma.order.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { total: true } }),
      app.prisma.order.count(),
      app.prisma.customer.count(),
      app.prisma.product.count(),
      app.prisma.order.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { customer: true, lines: true } }),
      app.prisma.product.findMany({ where: { status: 'ACTIVE' }, orderBy: { sold: 'desc' }, take: 5, include: { category: true } }),
      app.prisma.order.groupBy({ by: ['status'], _count: { status: true } }),
    ])

    const statusMap = Object.fromEntries(ordersByStatus.map(s => [s.status, s._count.status]))

    return reply.send({
      stats: {
        revenue:   Number(totalRevenue._sum.total ?? 0),
        orders:    totalOrders,
        customers: totalCustomers,
        products:  totalProducts,
      },
      ordersByStatus: {
        pending:    statusMap['PENDING']    ?? 0,
        processing: statusMap['PROCESSING'] ?? 0,
        shipped:    statusMap['SHIPPED']    ?? 0,
        delivered:  statusMap['DELIVERED']  ?? 0,
        cancelled:  statusMap['CANCELLED']  ?? 0,
      },
      recentOrders,
      topProducts,
    })
  })
}