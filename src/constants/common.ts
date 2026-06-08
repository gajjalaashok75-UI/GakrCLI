import memoize from 'lodash-es/memoize.js'

// This ensures you get the LOCAL date in ISO format
export function getLocalISODate(): string {
  // Check for ant-only date override
  if (process.env.GAKR_CODE_OVERRIDE_DATE) {
    return process.env.GAKR_CODE_OVERRIDE_DATE
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Memoized for prompt-cache stability — captures the date once at session start.
// The main interactive path gets this behavior via memoize(getUserContext) in
// context.ts; simple mode (--bare) calls getSystemPrompt per-request and needs
// an explicit memoized date to avoid busting the cached prefix at midnight.
// When midnight rolls over, getDateChangeAttachments appends the new date at
// the tail (though simple mode disables attachments, so the trade-off there is:
// stale date after midnight vs. ~entire-conversation cache bust — stale wins).
export const getSessionStartDate = memoize(getLocalISODate)

// --- Dynamic location (IP-based, optional) ---
// Fetches the user's IP location once per session via ip-api.com (free, no key).
// Returns null on any failure (offline, blocked, API down) — never throws.
let _locationPromise: Promise<string | null> | null = null

// Test-only: resets memoized location so each test gets a fresh fetch
export function __resetUserLocationForTests() {
  _locationPromise = null
}

export async function getUserLocation(): Promise<string | null> {
  if (_locationPromise) return _locationPromise
  _locationPromise = (async () => {
    try {
      const res = await fetch('http://ip-api.com/json/', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return null
      const data: { city?: string; regionName?: string; country?: string; status?: string } = await res.json()
    if (!data || data.status !== 'success' || !data.city) return null
    const parts = [data.city, data.regionName, data.country].filter(Boolean)
    return parts.join(', ')
    } catch {
      return null
    }
  })()
  return _locationPromise
}

// Returns "Month YYYY" (e.g. "February 2026") in the user's local timezone.
// Changes monthly, not daily — used in tool prompts to minimize cache busting.
export function getLocalMonthYear(): string {
  const date = process.env.GAKR_CODE_OVERRIDE_DATE
    ? new Date(process.env.GAKR_CODE_OVERRIDE_DATE)
    : new Date()
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}
