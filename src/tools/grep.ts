import type { Tool } from '../types.ts'
import { spawn, spawnSync } from 'node:child_process'
import { readdir, readFile as readFromDisk, stat } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import process from 'node:process'
import { resolveInsideWorkingDirectory, truncateText } from './shared.ts'

const SEARCH_TIMEOUT_MS = 30_000
const MAX_FILE_BYTES = 5 * 1024 * 1024
const PREVIEW_MATCH_COUNT = 10
const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
])

const ripgrepAvailable = (() => {
  try {
    const probe = spawnSync('rg', ['--version'], { stdio: 'ignore' })
    return probe.status === 0
  }
  catch {
    return false
  }
})()

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')

  return new RegExp(`^${escaped}$`)
}

async function searchWithRipgrep(
  pattern: string,
  searchPath: string,
  glob: string | undefined,
  caseSensitive: boolean,
): Promise<string> {
  return await new Promise<string>((resolveResult) => {
    const ripgrepArguments = ['--line-number', '--color', 'never', '--no-heading']
    if (!caseSensitive) {
      ripgrepArguments.push('--ignore-case')
    }
    if (glob) {
      ripgrepArguments.push('--glob', glob)
    }
    ripgrepArguments.push('--regexp', pattern, searchPath)

    const ripgrepProcess = spawn('rg', ripgrepArguments, {
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    })

    ripgrepProcess.stdout.setEncoding('utf8')
    ripgrepProcess.stderr.setEncoding('utf8')
    ripgrepProcess.stdin.end()

    let collectedStdout = ''
    let collectedStderr = ''

    ripgrepProcess.stdout.on('data', (text: string) => {
      collectedStdout += text
    })

    ripgrepProcess.stderr.on('data', (text: string) => {
      collectedStderr += text
    })

    ripgrepProcess.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolveResult(collectedStdout)
        return
      }
      if (exitCode === 1) {
        resolveResult(`No matches for "${pattern}" in ${relative(process.cwd(), searchPath) || '.'}`)
        return
      }
      resolveResult(`ERROR: ripgrep failed (exit=${exitCode})\n${collectedStderr.trim()}`)
    })

    ripgrepProcess.on('error', (error) => {
      resolveResult(`ERROR: ${error.message}`)
    })
  })
}

async function* walkFiles(start: string): AsyncGenerator<string> {
  const stats = await stat(start).catch(() => null)
  if (!stats) {
    return
  }
  if (stats.isFile()) {
    yield start
    return
  }
  if (!stats.isDirectory()) {
    return
  }

  const entries = await readdir(start, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
      continue
    }
    const fullPath = join(start, entry.name)
    if (entry.isDirectory()) {
      yield* walkFiles(fullPath)
    }
    else if (entry.isFile()) {
      yield fullPath
    }
  }
}

async function searchWithNode(
  pattern: string,
  searchPath: string,
  glob: string | undefined,
  caseSensitive: boolean,
): Promise<string> {
  let regex: RegExp
  try {
    regex = new RegExp(pattern, caseSensitive ? '' : 'i')
  }
  catch (error) {
    return `ERROR: invalid regex: ${(error as Error).message}`
  }

  const globRegex = glob ? globToRegex(glob) : null
  const collectedMatches: string[] = []
  const workingDirectory = process.cwd()

  for await (const file of walkFiles(searchPath)) {
    if (globRegex && !globRegex.test(basename(file))) {
      continue
    }

    const fileStats = await stat(file).catch(() => null)
    if (!fileStats || fileStats.size > MAX_FILE_BYTES) {
      continue
    }

    let content: string
    try {
      content = await readFromDisk(file, 'utf8')
    }
    catch {
      continue
    }

    if (content.includes('\0')) {
      continue
    }

    const lines = content.split('\n')
    const relativePath = relative(workingDirectory, file) || file
    let lineNumber = 0
    for (const line of lines) {
      lineNumber += 1
      if (regex.test(line)) {
        collectedMatches.push(`${relativePath}:${lineNumber}:${line}`)
      }
    }
  }

  if (collectedMatches.length === 0) {
    return `No matches for "${pattern}" in ${relative(workingDirectory, searchPath) || '.'}`
  }

  return collectedMatches.join('\n')
}

export const grep: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Searches files for a regex pattern. Returns matching lines as `path:line:text`. Uses ripgrep when available, otherwise a Node fallback. Skips .git, node_modules, dist, build, .next, out, coverage. Confined to the current working directory.',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Regex pattern to search for.',
          },
          path: {
            type: 'string',
            description: 'File or directory to search in. Defaults to the current working directory.',
          },
          glob: {
            type: 'string',
            description: 'Filename glob filter (e.g. "*.ts"). Matches against basename.',
          },
          caseSensitive: {
            type: 'boolean',
            description: 'Case-sensitive matching. Defaults to true.',
          },
        },
        required: ['pattern'],
      },
    },
  },
  handler: async (rawArguments: unknown) => {
    const args = (rawArguments ?? {}) as {
      pattern?: unknown
      path?: unknown
      glob?: unknown
      caseSensitive?: unknown
    }
    const pattern = args.pattern
    const pathInput = typeof args.path === 'string' ? args.path : '.'
    const glob = typeof args.glob === 'string' ? args.glob : undefined
    const caseSensitive = args.caseSensitive !== false

    if (typeof pattern !== 'string' || pattern.length === 0) {
      return 'ERROR: grep expects { pattern: string, path?: string, glob?: string, caseSensitive?: boolean }'
    }

    const resolved = resolveInsideWorkingDirectory(pathInput)
    if (!resolved.ok) {
      return `ERROR: ${resolved.error}`
    }

    const result = ripgrepAvailable
      ? await searchWithRipgrep(pattern, resolved.absolute, glob, caseSensitive)
      : await searchWithNode(pattern, resolved.absolute, glob, caseSensitive)

    return truncateText(result)
  },
  primaryArgs: ['pattern', 'path', 'glob', 'caseSensitive'],
  renderResult: (_args, result) => {
    if (result.startsWith('No matches')) {
      const firstLineEnd = result.indexOf('\n')
      return firstLineEnd === -1 ? result : result.slice(0, firstLineEnd)
    }

    const lines = result.split('\n').filter(line => line.length > 0 && !line.startsWith('...['))
    const fileSet = new Set<string>()

    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        fileSet.add(line.slice(0, colonIndex))
      }
    }

    const header = `Found ${lines.length} matches in ${fileSet.size} files`
    const preview = lines.slice(0, PREVIEW_MATCH_COUNT).join('\n')
    const remainder = lines.length > PREVIEW_MATCH_COUNT
      ? `\n… +${lines.length - PREVIEW_MATCH_COUNT} more matches`
      : ''

    return `${header}\n${preview}${remainder}`
  },
}
