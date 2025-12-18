'use client'

import { LiveFeed } from '@/components/ui/live-feed'

// =============================================================================
// LIVE FEED SECTION COMPONENT
// Wrapper for the live feed on the home page
// =============================================================================

export function LiveFeedSection() {
  return (
    <LiveFeed
      className="h-full min-h-[300px]"
      maxItems={5}
      pollInterval={10000}
    />
  )
}
