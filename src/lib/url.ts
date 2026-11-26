function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0)
    if (code !== undefined && (code <= 31 || (code >= 127 && code <= 159))) return true
  }
  return false
}

function isValidHostname(hostname: string, requireDomain: boolean): boolean {
  const normalized = hostname.replace(/\.$/, '').toLowerCase()
  if (!normalized) return false
  if (normalized.startsWith('[') && normalized.endsWith(']')) return !requireDomain

  const labels = normalized.split('.')
  if (requireDomain && labels.length < 2) return false
  if (!labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return false

  const topLevelDomain = labels[labels.length - 1]
  return !requireDomain || (topLevelDomain.length >= 2 && !/^\d+$/.test(topLevelDomain))
}

export function normalizeUrl(raw: string): string | null {
  if (
    !raw
    || raw.startsWith('/')
    || raw.includes('\\')
    || /\s/.test(raw)
    || hasControlCharacter(raw)
    || /%(?![0-9a-f]{2})/i.test(raw)
  ) return null

  const isHttpUrl = /^https?:\/\//i.test(raw)
  if (/^https?:\/\/\//i.test(raw)) return null
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(raw)
  const isHostWithPort = /^[^/?#@:\\]+:\d+(?:[/?#]|$)/.test(raw)
  if (hasScheme && !isHttpUrl && !isHostWithPort) return null

  const candidate = isHttpUrl ? raw : `https://${raw}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname || url.username || url.password) return null
    if (!isValidHostname(url.hostname, !isHttpUrl)) return null
    return candidate
  } catch {
    return null
  }
}

export function normalizeClientUrl(raw: string | null): string | null {
  if (!raw?.trim()) return ''
  return normalizeUrl(raw)
}

export function normalizeInstagramUrl(raw: string | null): string | null {
  if (!raw) return ''
  if (raw.startsWith('@')) {
    const username = raw.slice(1)
    return !username.includes('..') && /^[a-z\d_](?:[a-z\d._]{0,28}[a-z\d_])?$/i.test(username)
      ? `https://www.instagram.com/${username}/`
      : null
  }
  const normalized = normalizeUrl(raw)
  if (!normalized) return null
  try {
    const hostname = new URL(normalized).hostname.toLowerCase().replace(/\.$/, '')
    return hostname === 'instagram.com' || hostname.endsWith('.instagram.com') ? normalized : null
  } catch {
    return null
  }
}

export function normalizeMapsUrl(raw: string | null): string | null {
  if (!raw) return ''
  const normalized = normalizeUrl(raw)
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
    if (hostname === 'maps.app.goo.gl') return url.pathname.length > 1 ? normalized : null
    if (hostname === 'goo.gl') return /^\/maps\/[^/]+\/?$/.test(url.pathname) ? normalized : null
    const isMapsHost = hostname === 'maps.google.com'
    const isGoogleHost = /^(?:www\.)?google\.com(?:\.[a-z]{2})?$/.test(hostname)
    if (!isMapsHost && !isGoogleHost) return null
    if (!isMapsHost && url.pathname !== '/maps' && !url.pathname.startsWith('/maps/')) return null

    const hasPlacePath = /^\/maps\/(?:preview\/)?place\/[^/]+/.test(url.pathname)
    const hasPlaceId = ['q', 'query'].some((parameter) => {
      const value = url.searchParams.get(parameter)?.toLowerCase() ?? ''
      return value.startsWith('placeid:') && /^\S+$/.test(value.slice('placeid:'.length))
    }) || /^\S+$/.test(url.searchParams.get('query_place_id') ?? '')
    const hasCid = /^\d+$/.test(url.searchParams.get('cid') ?? '')
    return hasPlacePath || hasPlaceId || hasCid ? normalized : null
  } catch {
    return null
  }
}

export function buildMapsSearchUrl(parts: Array<string | null | undefined>): string | null {
  const query = parts.map((part) => part?.trim() ?? '').filter(Boolean).join(', ')
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null
}
