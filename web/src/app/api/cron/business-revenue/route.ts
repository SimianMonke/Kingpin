import { NextRequest } from 'next/server'
import {
  successResponse,
  forbiddenResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { BusinessService } from '@/lib/services/business.service'

/**
 * GET /api/cron/business-revenue
 * Collect revenue from all equipped businesses
 * Runs every 3 hours (cron: 0 0,3,6,9,12,15,18,21 * * *)
 *
 * Revenue = (dailyRevenuePotential / 8) with +/-20% variance
 * Net = Revenue - Operating Costs
 *
 * Protected by CRON_SECRET (Vercel Cron) or ADMIN_API_KEY
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const adminKey = request.headers.get('x-api-key')

  const isVercelCron = authHeader === `Bearer ${cronSecret}`
  const isAdminAuth = adminKey === process.env.ADMIN_API_KEY

  if (!isVercelCron && !isAdminAuth) {
    return forbiddenResponse('Unauthorized cron request')
  }

  const startTime = Date.now()

  // Collect revenue for all users with equipped businesses
  const summary = await BusinessService.collectAllRevenue()

  const duration = Date.now() - startTime

  return successResponse({
    timestamp: new Date().toISOString(),
    job: 'business-revenue-collection',
    duration: `${duration}ms`,
    summary: {
      usersProcessed: summary.usersProcessed,
      businessesProcessed: summary.businessesProcessed,
      totalRevenueDistributed: summary.totalRevenueDistributed,
      averagePerBusiness: summary.businessesProcessed > 0
        ? Math.floor(summary.totalRevenueDistributed / summary.businessesProcessed)
        : 0,
    },
    errors: summary.errors.length > 0 ? summary.errors : undefined,
    status: summary.errors.length === 0 ? 'success' : 'partial_failure',
  })
})
