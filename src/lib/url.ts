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
