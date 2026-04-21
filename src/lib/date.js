export function localDateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseLocalDate(key) {
  if (!key) return new Date()
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isoToLocalDateKey(isoString) {
  if (!isoString) return localDateKey()
  return localDateKey(new Date(isoString))
}

export function formatCardDate(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function formatRelativeTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d ago`
}

export function formatMinutesAgo(timestamp) {
  const diffMs = Date.now() - timestamp
  const diffMins = Math.max(0, Math.floor(diffMs / 60000))
  if (diffMins === 0) return 'just now'
  return `${diffMins} min ago`
}
