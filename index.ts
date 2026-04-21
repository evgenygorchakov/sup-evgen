#!/usr/bin/env -S node --env-file=.env
import process from 'node:process'
import { run } from './src/agent.ts'
import { getProvider } from './src/providers/index.ts'
import { getEnvValue } from './src/utils/env.ts'

const LANGUAGE = getEnvValue('LANGUAGE')

const SYSTEM_PROMPT = [
  'You are a local assistant agent running on the user\'s machine.',
  'You have the run_shell tool: it executes a bash command and returns stdout, stderr and the exit code.',
  'Before calling a tool, describe your intent in one short sentence.',
  'Do not request tools if the answer is already known from the conversation. If a task cannot be solved, say so directly.',
  `Always respond to the user in ${LANGUAGE}.`,
].join('\n\n')

const userPrompt = process.argv.slice(2).join(' ').trim()
if (!userPrompt) {
  console.error('Usage: sup <prompt>')
  process.exit(1)
}

async function main() {
  await run(getProvider(), [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ])
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
