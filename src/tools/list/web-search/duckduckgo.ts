import { htmlToText } from '../../../utils/html-to-text.ts'

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

const DUCKDUCKGO_LITE_ENDPOINT = 'https://lite.duckduckgo.com/lite/'
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) sup-evgen/0.1'
const SEARCH_TIMEOUT_MS = 15_000

const ANOMALY_MARKERS = [
  'Unfortunately, bots use DuckDuckGo too',
  'anomaly-modal',
  'anomaly.js',
]

export async function searchDuckDuckGo(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const requestBody = new URLSearchParams({ q: query })

  const response = await fetch(DUCKDUCKGO_LITE_ENDPOINT, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://lite.duckduckgo.com/',
      'DNT': '1',
    },
    body: requestBody,
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`DuckDuckGo returned HTTP ${response.status}`)
  }

  const html = await response.text()

  return extractResultsFromHtml(html, maxResults)
}

function extractResultsFromHtml(html: string, maxResults: number): WebSearchResult[] {
  const linkPattern = /<a\s[^>]*class="[^"]*\bresult-link\b[^"]*"[^>]*\shref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  const snippetPattern = /<td\s[^>]*class="[^"]*\bresult-snippet\b[^"]*"[^>]*>([\s\S]*?)<\/td>/g

  const linkMatches = [...html.matchAll(linkPattern)]
  const snippetMatches = [...html.matchAll(snippetPattern)]

  if (linkMatches.length === 0) {
    const isAnomalyPage = ANOMALY_MARKERS.some(marker => html.includes(marker))
    if (isAnomalyPage) {
      throw new Error('DuckDuckGo blocked the request with anti-bot protection (anomaly/captcha page). Retry later or switch network.')
    }
    return []
  }

  const results: WebSearchResult[] = []

  for (let index = 0; index < linkMatches.length && results.length < maxResults; index += 1) {
    const rawHref = linkMatches[index]![1]!
    const rawTitle = linkMatches[index]![2]!
    const rawSnippet = snippetMatches[index]?.[1] ?? ''

    const realUrl = decodeRedirectHref(rawHref)
    if (!realUrl) {
      continue
    }

    results.push({
      title: htmlToText(rawTitle),
      url: realUrl,
      snippet: htmlToText(rawSnippet),
    })
  }

  return results
}

function decodeRedirectHref(href: string): string | null {
  try {
    const absoluteHref = href.startsWith('//')
      ? `https:${href}`
      : /^https?:\/\//.test(href)
        ? href
        : `https://duckduckgo.com${href}`

    const parsed = new URL(absoluteHref)

    if (parsed.hostname.endsWith('duckduckgo.com')) {
      return parsed.searchParams.get('uddg')
    }

    return parsed.toString()
  }
  catch {
    return null
  }
}
