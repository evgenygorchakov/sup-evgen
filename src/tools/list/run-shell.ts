import type { Tool } from '../../types.ts'
import { spawn } from 'node:child_process'
import { yellow } from '../../utils/colors.ts'
import { truncateText } from './shared.ts'

const COMMAND_TIMEOUT_MS = 30_000

export const runShell: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'run_shell',
      description: 'Executes a bash command in the user\'s shell (unsandboxed, user\'s permissions). Returns exit code, stdout, and stderr.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The bash command to execute (passed to `bash -c`).',
          },
        },
        required: ['command'],
      },
    },
  },
  handler: async (rawArguments: unknown) => {
    const command = (rawArguments as { command?: unknown })?.command

    if (typeof command !== 'string') {
      return 'ERROR: run_shell expects { command: string }'
    }

    return await new Promise<string>((resolve) => {
      const bashProcess = spawn('bash', ['-c', command], {
        signal: AbortSignal.timeout(COMMAND_TIMEOUT_MS),
      })

      bashProcess.stdout.setEncoding('utf8')
      bashProcess.stderr.setEncoding('utf8')
      bashProcess.stdin.end()

      let collectedStdout = ''
      let collectedStderr = ''

      bashProcess.stdout.on('data', (text: string) => {
        collectedStdout += text
      })

      bashProcess.stderr.on('data', (text: string) => {
        collectedStderr += text
      })

      bashProcess.on('close', (exitCode) => {
        resolve(`exit=${exitCode}\nstdout:\n${truncateText(collectedStdout)}\nstderr:\n${truncateText(collectedStderr)}`)
      })

      bashProcess.on('error', (error) => {
        resolve(`exec_error: ${error.message}\nstdout:\n${truncateText(collectedStdout)}\nstderr:\n${truncateText(collectedStderr)}`)
      })
    })
  },
  primaryArgs: ['command'],
  accentColor: yellow,
  renderResult: (_args, result) => {
    const exitMatch = result.match(/^exit=(-?\d+)\nstdout:\n([\s\S]*?)\nstderr:\n([\s\S]*)$/)
    if (!exitMatch) {
      return result
    }

    const exitCode = exitMatch[1]!
    const stdout = exitMatch[2]!
    const stderr = exitMatch[3]!
    const trimmedStdout = stdout.trim()
    const trimmedStderr = stderr.trim()
    if (exitCode === '0') {
      return trimmedStdout || '(no output)'
    }

    const parts: string[] = [`exit=${exitCode}`]
    if (trimmedStdout) {
      parts.push(trimmedStdout)
    }

    if (trimmedStderr) {
      parts.push(`stderr: ${trimmedStderr}`)
    }

    return parts.join('\n')
  },
}
