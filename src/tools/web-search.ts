import type { Tool } from '../types.ts'
import { Config } from '../config.ts'
import { searchDuckDuckGo } from '../providers/web-search/duckduckgo.ts'
import { truncateText } from './shared.ts'

const PREVIEW_RESULT_COUNT = 5

export const webSearch: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Searches the web via DuckDuckGo and returns a list of results with title, URL and snippet. Use this when you need fresh information from the internet (e.g. latest library versions, recent events, current docs). Pair with fetch_url to read a specific page.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query in plain text.',
          },
          maxResults: {
            type: 'number',
            description: `Maximum number of results to return. Capped at ${Config.WEB_SEARCH_MAX_RESULTS}.`,
          },
        },
        required: ['query'],
      },
    },
  },
  handler: async (rawArguments: unknown) => {
    const args = (rawArguments ?? {}) as { query?: unknown, maxResults?: unknown }
    const query = args.query

    if (typeof query !== 'string' || query.trim().length === 0) {
      return 'ERROR: web_search expects { query: string, maxResults?: number }'
    }

    const requestedCount = typeof args.maxResults === 'number' ? args.maxResults : Config.WEB_SEARCH_MAX_RESULTS
    const resultsLimit = Math.max(1, Math.min(Config.WEB_SEARCH_MAX_RESULTS, requestedCount))

    const results = await searchDuckDuckGo(query.trim(), resultsLimit)

    if (results.length === 0) {
      return `No results for "${query.trim()}"`
    }

    const formatted = results
      .map((entry, index) => `${index + 1}. ${entry.title}\n   ${entry.url}\n   ${entry.snippet}`)
      .join('\n\n')

    return truncateText(formatted)
  },
  primaryArgs: ['query', 'maxResults'],
  renderResult: (args, result) => {
    if (result.startsWith('No results')) {
      return result
    }

    const entries = result.split('\n\n').filter(entry => entry.length > 0 && !entry.startsWith('...['))
    const query = typeof args.query === 'string' ? args.query : ''
    const header = `Found ${entries.length} results for "${query}"`

    const preview = entries
      .slice(0, PREVIEW_RESULT_COUNT)
      .map((entry) => {
        const [titleLine, urlLine] = entry.split('\n')
        return `${titleLine}\n${urlLine ?? ''}`
      })
      .join('\n')

    const remainder = entries.length > PREVIEW_RESULT_COUNT
      ? `\n… +${entries.length - PREVIEW_RESULT_COUNT} more results`
      : ''

    return `${header}\n${preview}${remainder}`
  },
}
