#!/usr/bin/env node
import type { Message } from './src/types.ts'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process, { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { run } from './src/agent.ts'
import { getProvider } from './src/providers/index.ts'
import { bold, brightGreen, gray } from './src/utils/colors.ts'
import { getConfigValue } from './src/utils/env.ts'

const LANGUAGE = getConfigValue('LANGUAGE')

const SYSTEM_PROMPT = [
  'You are a local CLI assistant running on the user\'s machine.',
  'Tool: run_shell — executes a bash command and returns exit code, stdout, stderr.',
  'Style:',
  '- Be terse. Prefer 1-3 short lines unless the user asks for detail.',
  '- No preambles ("Sure", "Of course", "I\'ll..."). No closing summaries ("I\'ve done X, Y, Z", "Hope that helps").',
  '- Do not restate tool output. Answer only what was asked.',
  '- No emojis, no flattery, no apologies, no filler.',
  '- Before each tool call, state your intent in one short sentence — nothing more.',
  '- Skip the tool if the answer is already known from the conversation. If the task cannot be done, say so directly.',
  `Always respond in ${LANGUAGE}.`,
].join('\n')

const EXIT_WORDS = new Set(['exit', 'quit', ':q'])
const PROMPT = bold(brightGreen('> '))

async function loadProjectInstructions(): Promise<string | null> {
  try {
    const path = resolve(process.cwd(), 'AGENTS.md')
    const content = (await readFile(path, 'utf8')).trim()
    return content || null
  }
  catch {
    return null
  }
}

async function main() {
  const provider = getProvider()
  const rl = createInterface({ input: stdin, output: stdout })

  const projectInstructions = await loadProjectInstructions()
  const systemContent = projectInstructions
    ? `${SYSTEM_PROMPT}\n\nProject instructions (from AGENTS.md):\n${projectInstructions}`
    : SYSTEM_PROMPT

  const messages: Message[] = [{ role: 'system', content: systemContent }]

  if (projectInstructions) {
    console.warn(gray('Loaded AGENTS.md'))
  }

  const firstPrompt = process.argv.slice(2).join(' ').trim()
  if (firstPrompt) {
    messages.push({ role: 'user', content: firstPrompt })
    await run(provider, messages, rl)
  }

  console.warn(gray('\nType "exit" or press Ctrl+D to quit.'))

  try {
    while (true) {
      let input: string
      try {
        input = (await rl.question(`\n${PROMPT}`)).trim()
      }
      catch {
        break
      }

      if (!input)
        continue
      if (EXIT_WORDS.has(input.toLowerCase()))
        break

      messages.push({ role: 'user', content: input })
      await run(provider, messages, rl)
    }
  }
  finally {
    rl.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
