import { htmlToText } from '../../utils/html-to-text.ts'

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

const DUCKDUCKGO_HTML_ENDPOINT = 'https://html.duckduckgo.com/html/'
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) sup-evgen/0.1'
const SEARCH_TIMEOUT_MS = 15_000

export async function searchDuckDuckGo(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const requestBody = new URLSearchParams({ q: query })

  const response = await fetch(DUCKDUCKGO_HTML_ENDPOINT, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html',
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
  const titleAndHrefPattern = /<a\b[^>]*\bclass="[^"]*\bresult__a\b[^"]*"[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  const snippetPattern = /<a\b[^>]*\bclass="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g

  const titleMatches = [...html.matchAll(titleAndHrefPattern)]
  const snippetMatches = [...html.matchAll(snippetPattern)]

  const results: WebSearchResult[] = []

  for (let index = 0; index < titleMatches.length && results.length < maxResults; index += 1) {
    const rawHref = titleMatches[index]![1]!
    const rawTitle = titleMatches[index]![2]!
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
