export function resolveProfileName(profile, fallbackEmail = '?') {
  if (!profile) return fallbackEmail.split('@')[0]
  if (profile.display_name && profile.display_name.trim()) {
    return profile.display_name.trim()
  }
  if (profile.full_name && profile.full_name.trim()) {
    return profile.full_name.trim()
  }
  return fallbackEmail.split('@')[0]
}

export function getInitials(name, email) {
  const n = (name || '').trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2)
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return n.slice(0, 2).toUpperCase()
  }
  const e = (email || '').split('@')[0] || '?'
  return e.slice(0, 2).toUpperCase()
}
