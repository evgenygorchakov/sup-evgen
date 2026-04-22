#!/usr/bin/env node
import type { Interface as ReadlineInterface } from 'node:readline/promises'
import type { ChatProvider } from './src/providers/types.ts'
import type { Message } from './src/types.ts'

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process, { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { run } from './src/agent.ts'
import { Config } from './src/config.ts'
import { getProvider } from './src/providers/index.ts'
import { bold, brightGreen, gray } from './src/utils/colors.ts'

const language = Config.LANGUAGE

const SYSTEM_PROMPT = [
  'You are a local CLI assistant running on the user\'s machine.',
  'Tool: run_shell — executes a bash command and returns exit code, stdout, stderr.',
  'Style:',
  '- Be terse. Prefer 1-3 short lines unless the user asks for detail.',
  '- No preambles ("Sure", "Of course", "I\'ll..."). No closing summaries ("I\'ve done X, Y, Z", "Hope that helps").',
  '- Do not restate tool output. Answer only what was asked.',
  '- No emojis, no flattery, no apologies, no filler.',
  '- Before each tool call, state your intent in one short sentence. This is not a final answer.',
  '- If you already know the answer, reply in plain text. Never wrap your own answer in run_shell, cat/heredoc, echo or printf.',
  '- run_shell is only for commands whose output you do not yet have.',
  '- Skip the tool if the answer is already known from the conversation. If the task cannot be done, say so directly.',
  `Always respond in ${language}.`,
].join('\n')

const EXIT_COMMANDS = new Set(['exit', 'quit', ':q'])
const PROMPT_MARKER = bold(brightGreen('> '))

async function loadProjectInstructions(): Promise<string | null> {
  try {
    const filePath = resolve(process.cwd(), 'AGENTS.md')
    const fileContent = (await readFile(filePath, 'utf8')).trim()
    return fileContent || null
  }
  catch {
    return null
  }
}

async function handleUserTurn(provider: ChatProvider, messages: Message[], readline: ReadlineInterface, userInput: string): Promise<void> {
  messages.push({ role: 'user', content: userInput })
  await run(provider, messages, readline)
}

async function main() {
  const provider = getProvider()
  const readline = createInterface({ input: stdin, output: stdout })

  process.once('SIGINT', () => {
    readline.close()
    process.exit(130)
  })

  const projectInstructions = await loadProjectInstructions()
  const systemContent = projectInstructions
    ? `${SYSTEM_PROMPT}\n\nProject instructions (from AGENTS.md):\n${projectInstructions}`
    : SYSTEM_PROMPT

  const messages: Message[] = [{ role: 'system', content: systemContent }]

  if (projectInstructions) {
    console.warn(gray('Loaded AGENTS.md'))
  }

  const commandLinePrompt = process.argv.slice(2).join(' ').trim()
  if (commandLinePrompt) {
    await handleUserTurn(provider, messages, readline, commandLinePrompt)
  }

  console.warn(gray('\nType "exit" or press Ctrl+D to quit.'))

  try {
    while (true) {
      let userInput: string

      try {
        userInput = (await readline.question(`\n${PROMPT_MARKER}`)).trim()
      }

      catch {
        break
      }

      if (!userInput) {
        continue
      }

      if (EXIT_COMMANDS.has(userInput.toLowerCase())) {
        break
      }

      await handleUserTurn(provider, messages, readline, userInput)
    }
  }
  finally {
    readline.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
