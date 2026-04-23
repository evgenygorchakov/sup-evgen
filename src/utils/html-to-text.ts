import { isIP } from 'node:net'

const TAGS_TO_REMOVE_WITH_CONTENT = ['script', 'style', 'noscript', 'nav', 'footer', 'form', 'header', 'aside', 'svg']

const BLOCK_CLOSING_TAGS = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'section', 'article']

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '\'',
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  copy: '©',
  reg: '®',
}

export function htmlToText(html: string): string {
  let text = html

  for (const tag of TAGS_TO_REMOVE_WITH_CONTENT) {
    const blockPattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi')
    text = text.replace(blockPattern, '')
  }

  text = text.replace(/<br\s*\/?>/gi, '\n')
  for (const tag of BLOCK_CLOSING_TAGS) {
    const closingPattern = new RegExp(`</${tag}\\s*>`, 'gi')
    text = text.replace(closingPattern, '\n')
  }

  text = text.replace(/<!--[\s\S]*?-->/g, '')
  text = text.replace(/<[^>]+>/g, '')
  text = decodeHtmlEntities(text)

  return text
    .split('\n')
    .map(line => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, digits: string) => safeFromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeFromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (fullMatch, name: string) => NAMED_HTML_ENTITIES[name.toLowerCase()] ?? fullMatch)
}

function safeFromCodePoint(codePoint: number): string {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) {
    return ''
  }
  try {
    return String.fromCodePoint(codePoint)
  }
  catch {
    return ''
  }
}

function parseIpv4Address(address: string): number {
  const parts = address.split('.').map(Number)
  return parts[0]! * 0x01000000 + parts[1]! * 0x010000 + parts[2]! * 0x0100 + parts[3]!
}

function buildIpv4Range(baseAddress: string, prefixBits: number): [number, number] {
  const baseValue = parseIpv4Address(baseAddress)
  const rangeSize = 2 ** (32 - prefixBits)

  return [baseValue, baseValue + rangeSize - 1]
}

const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  buildIpv4Range('0.0.0.0', 8),
  buildIpv4Range('10.0.0.0', 8),
  buildIpv4Range('127.0.0.0', 8),
  buildIpv4Range('169.254.0.0', 16),
  buildIpv4Range('172.16.0.0', 12),
  buildIpv4Range('192.168.0.0', 16),
]

export function isPrivateHost(hostname: string): boolean {
  const lowered = hostname.toLowerCase()

  if (lowered === 'localhost' || lowered.endsWith('.localhost')) {
    return true
  }

  const ipVersion = isIP(hostname)

  if (ipVersion === 4) {
    const asInteger = parseIpv4Address(hostname)
    return PRIVATE_IPV4_RANGES.some(([rangeStart, rangeEnd]) => asInteger >= rangeStart && asInteger <= rangeEnd)
  }

  if (ipVersion === 6) {
    if (lowered === '::1' || lowered === '::') {
      return true
    }
    if (lowered.startsWith('fc') || lowered.startsWith('fd')) {
      return true
    }
    if (/^fe[89ab][0-9a-f]?:/.test(lowered)) {
      return true
    }
  }

  return false
}
