import type { Tool } from '../types.ts'
import { Buffer } from 'node:buffer'
import { mkdir, stat, writeFile as writeToDisk } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import process from 'node:process'

async function fileExists(absolute: string): Promise<boolean> {
  try {
    await stat(absolute)
    return true
  }
  catch {
    return false
  }
}

function isInsideCwd(absolute: string): boolean {
  const cwd = process.cwd()
  return absolute === cwd || absolute.startsWith(cwd + sep)
}

export const writeFile: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'write_file',
      description:
          'Writes UTF-8 text to a file. Creates missing parent directories. Refuses to overwrite existing files unless overwrite is true. Confined to the current working directory.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file. Relative paths resolve from the current working directory.',
          },
          content: {
            type: 'string',
            description: 'Full file content to write.',
          },
          overwrite: {
            type: 'boolean',
            description: 'Set to true to replace an existing file. Defaults to false.',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  handler: async (rawArguments: unknown) => {
    const args = (rawArguments ?? {}) as { path?: unknown, content?: unknown, overwrite?: unknown }
    const path = args.path
    const content = args.content
    const overwrite = args.overwrite === true

    if (typeof path !== 'string') {
      return 'ERROR: write_file expects { path: string, content: string, overwrite?: boolean }'
    }

    if (typeof content !== 'string') {
      return 'ERROR: write_file expects content to be a string'
    }

    const absolute = resolve(process.cwd(), path)

    if (!isInsideCwd(absolute)) {
      return `ERROR: path "${path}" is outside the current working directory`
    }

    if (!overwrite && await fileExists(absolute)) {
      return `ERROR: file "${path}" already exists; pass overwrite: true to replace it`
    }

    try {
      await mkdir(dirname(absolute), { recursive: true })
      await writeToDisk(absolute, content, 'utf8')
    }
    catch (error) {
      return `ERROR: ${(error as Error).message}`
    }

    return `${overwrite ? 'Overwrote' : 'Wrote'} ${Buffer.byteLength(content, 'utf8')} bytes to ${path}`
  },
}
