import type { Tool } from '../types.ts'
import { spawn } from 'node:child_process'
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
}
