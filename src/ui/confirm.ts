import type { Interface as ReadlineInterface } from 'node:readline/promises'
import type { ChatProvider } from '../providers/types.ts'
import type { Message, ToolCall } from '../types.ts'

import { Config } from '../config.ts'
import { toolsByName } from '../tools/registry.ts'
import { bold, brightBlue, brightGreen, yellow } from '../utils/colors.ts'
import { renderToolHeader } from './render-tool-call.ts'

export const CONFIRM_KIND = {
  approve: 'approve',
  replan: 'replan',
  quit: 'quit',
} as const

export type ConfirmResult
  = | { kind: typeof CONFIRM_KIND.approve }
    | { kind: typeof CONFIRM_KIND.replan, feedback: string }
    | { kind: typeof CONFIRM_KIND.quit }

const EXPLAIN_CALLS_MESSAGE = `Before executing, briefly explain in ${Config.LANGUAGE} what each tool call you just proposed will do. Quote each call and add one short sentence below it. Do not call tools.`

async function askModelToExplainCalls(provider: ChatProvider, messages: Message[]): Promise<string> {
  const explanationRequest: Message = {
    role: 'user',
    content: EXPLAIN_CALLS_MESSAGE,
  }

  try {
    const explanation = await provider.chat([...messages, explanationRequest], [])
    return explanation.content.trim()
  }
  catch {
    return ''
  }
}

export async function confirmToolCalls(provider: ChatProvider, messages: Message[], calls: ToolCall[], fallbackIntent: string, readline: ReadlineInterface): Promise<ConfirmResult> {
  const explanation = Config.USE_DETAILED_COMMAND_EXPLANATION
    ? await askModelToExplainCalls(provider, messages)
    : ''
  const intent = (explanation || fallbackIntent).trim()

  if (intent) {
    console.warn(`\n${yellow(intent)}`)
  }

  console.warn(bold(brightBlue('\nModel wants to run:')))

  for (const call of calls) {
    console.warn(renderToolHeader(call, toolsByName[call.function.name]))
  }

  const userAnswer = (await readline.question(brightGreen('\n[y / n / type feedback] '))).trim()
  const loweredAnswer = userAnswer.toLowerCase()

  if (loweredAnswer === 'y') {
    return { kind: CONFIRM_KIND.approve }
  }

  if (!userAnswer || loweredAnswer === 'n') {
    return { kind: CONFIRM_KIND.quit }
  }

  return { kind: CONFIRM_KIND.replan, feedback: userAnswer }
}
