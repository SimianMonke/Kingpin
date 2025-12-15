import { NextRequest } from 'next/server'
import {
  successResponse,
  withErrorHandling,
} from '@/lib/api-utils'
import { FactionService } from '@/lib/services'

// =============================================================================
// GET /api/factions/territories - Get all territories with status
// =============================================================================

export const GET = withErrorHandling(async () => {
  const territories = await FactionService.getTerritoryStatus()

  // Group territories by control status
  const controlled = territories.filter(t => t.controllingFaction !== null)
  const neutral = territories.filter(t => t.controllingFaction === null)
  const contested = territories.filter(t => t.isContested)
  const standard = territories.filter(t => !t.isContested)

  // Calculate control summary per faction
  const controlSummary: Record<string, { name: string; count: number; colorHex: string | null }> = {}
  for (const t of controlled) {
    const factionName = t.controllingFaction!.name
    if (!controlSummary[factionName]) {
      controlSummary[factionName] = {
        name: factionName,
        count: 0,
        colorHex: t.controllingFaction!.colorHex,
      }
    }
    controlSummary[factionName].count++
  }

  return successResponse({
    territories,
    summary: {
      total: territories.length,
      controlled: controlled.length,
      neutral: neutral.length,
      contested: contested.length,
      standard: standard.length,
      byFaction: Object.values(controlSummary),
    },
  })
})
