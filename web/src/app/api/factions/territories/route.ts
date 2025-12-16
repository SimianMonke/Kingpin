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
  const contested = territories.filter(t => t.is_contested)
  const standard = territories.filter(t => !t.is_contested)

  // Calculate control summary per faction
  const controlSummary: Record<string, { name: string; count: number; color_hex: string | null }> = {}
  for (const t of controlled) {
    const faction_name = t.controllingFaction!.name
    if (!controlSummary[faction_name]) {
      controlSummary[faction_name] = {
        name: faction_name,
        count: 0,
        color_hex: t.controllingFaction!.color_hex,
      }
    }
    controlSummary[faction_name].count++
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
