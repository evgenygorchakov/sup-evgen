import { resolve, sep } from 'node:path'
import process from 'node:process'

type ResolvedPath
  = | { ok: true, absolute: string }
    | { ok: false, error: string }

const OUTPUT_CHAR_LIMIT = 20_000

export function truncateText(text: string, limit: number = OUTPUT_CHAR_LIMIT): string {
  if (text.length <= limit) {
    return text
  }

  return `${text.slice(0, limit)}\n...[truncated]`
}

export function resolveInsideWorkingDirectory(path: string): ResolvedPath {
  const workingDirectory = process.cwd()
  const absolute = resolve(workingDirectory, path)

  if (absolute !== workingDirectory && !absolute.startsWith(workingDirectory + sep)) {
    return { ok: false, error: `path "${path}" is outside the current working directory` }
  }

  return { ok: true, absolute }
}
