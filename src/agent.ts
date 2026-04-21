import type { Interface as ReadlineInterface } from 'node:readline/promises'
import type { ChatProvider } from './providers/types.ts'
import type {
  ChatChunk,
  ConfirmResult,
  Message,
  OnChunk,
  Tool,
  ToolCall,
  ToolDefinition,
} from './types.ts'

import process from 'node:process'
import { Config } from './config.ts'

import { runShell } from './tools/run-shell.ts'
import { CONFIRM_KIND } from './types.ts'
import { bold, brightBlue, brightGreen, gray, red, yellow } from './utils/colors.ts'

const language = Config.LANGUAGE
const useDetailedExplanation = Config.USE_DETAILED_COMMAND_EXPLANATION
const usePlanMode = Config.USE_PLAN_MODE

const EXPLAIN_CALLS_MESSAGE = `Before executing, briefly explain in ${language} what each tool call you just proposed will do. Quote each call and add one short sentence below it. Do not call tools.`
const PLAN_REQUEST_MESSAGE = `Before doing anything, describe in 2-4 short sentences in ${language} what you plan to do to answer the user. Do not call tools. Wait for approval.`

const registry: Tool[] = [runShell]
const tools: ToolDefinition[] = registry.map(t => t.def)
const byName: Record<string, Tool> = Object.fromEntries(
  registry.map(t => [t.def.function.name, t]),
)

async function dispatch(call: ToolCall): Promise<string> {
  const tool = byName[call.function.name]
  if (!tool)
    return `Unknown tool: ${call.function.name}`

  console.error(gray(`→ ${call.function.name}(${JSON.stringify(call.function.arguments)})`))

  return await tool
    .handler(call.function.arguments)
    .catch((e: Error) => `ERROR: ${e.message}`)
}

async function explainCalls(provider: ChatProvider, messages: Message[]): Promise<string> {
  const ask: Message = {
    role: 'user',
    content: EXPLAIN_CALLS_MESSAGE,
  }

  try {
    const explanation = await provider.chat([...messages, ask], tools)
    return explanation.content.trim()
  }
  catch {
    return ''
  }
}

function streamingCallback(paint: (text: string) => string): { onChunk: OnChunk, streamed: () => boolean } {
  let didStream = false

  const onChunk: OnChunk = (chunk: ChatChunk) => {
    if (chunk.content) {
      didStream = true
      process.stderr.write(paint(chunk.content))
    }
  }

  return { onChunk, streamed: () => didStream }
}

async function planTurn(provider: ChatProvider, messages: Message[], rl: ReadlineInterface): Promise<'proceed' | 'quit'> {
  while (true) {
    console.warn(bold(brightBlue('\nProposed plan:')))

    const { onChunk, streamed } = streamingCallback(yellow)
    const plan = await provider.chat(
      [...messages, { role: 'user', content: PLAN_REQUEST_MESSAGE }],
      [],
      onChunk,
    )

    if (streamed()) {
      process.stderr.write('\n')
    }
    else {
      const planText = plan.content.trim()

      if (planText) {
        console.warn(yellow(planText))
      }
    }

    const answer = (await rl.question(brightGreen('\n[y / n / type feedback] '))).trim()
    const lowered = answer.toLowerCase()

    if (lowered === 'y') {
      messages.push(plan)
      return 'proceed'
    }

    if (!answer || lowered === 'n') {
      return 'quit'
    }

    messages.push(plan)
    messages.push({ role: 'user', content: answer })
  }
}

async function confirmBatch(calls: ToolCall[], intent: string, rl: ReadlineInterface): Promise<ConfirmResult> {
  const trimmed = intent.trim()
  if (trimmed) {
    console.warn(`\n${yellow(trimmed)}`)
  }

  console.warn(bold(brightBlue('\nModel wants to run:')))

  for (const call of calls) {
    console.warn(` ${call.function.name}(${JSON.stringify(call.function.arguments)})`)
  }

  const answer = (await rl.question(brightGreen('\n[y / n / type feedback] '))).trim()
  const lowered = answer.toLowerCase()

  if (lowered === 'y') {
    return { kind: CONFIRM_KIND.approve }
  }

  if (!answer || lowered === 'n') {
    return { kind: CONFIRM_KIND.quit }
  }

  return { kind: CONFIRM_KIND.replan, feedback: answer }
}

export async function run(provider: ChatProvider, messages: Message[], rl: ReadlineInterface): Promise<void> {
  if (usePlanMode && messages[messages.length - 1]?.role === 'user') {
    const decision = await planTurn(provider, messages, rl)

    if (decision === 'quit') {
      console.error(red('Cancelled by user.'))
      return
    }
  }

  while (true) {
    const { onChunk, streamed } = streamingCallback(s => s)
    const reply = await provider.chat(messages, tools, onChunk)

    messages.push(reply)

    if (!reply.tool_calls?.length) {
      if (streamed()) {
        process.stderr.write('\n')
      }
      else {
        console.warn(reply.content)
      }
      return
    }

    if (streamed()) {
      process.stderr.write('\n')
    }

    const explanation = useDetailedExplanation ? await explainCalls(provider, messages) : ''

    const intent = explanation || reply.content
    const decision = await confirmBatch(reply.tool_calls, intent, rl)

    if (decision.kind === CONFIRM_KIND.quit) {
      console.error(red('Cancelled by user.'))
      return
    }

    if (decision.kind === CONFIRM_KIND.replan) {
      for (const _ of reply.tool_calls) {
        messages.push({ role: 'tool', content: 'Rejected by user. Do not run this command.' })
      }

      messages.push({ role: 'user', content: decision.feedback })
      continue
    }

    for (const call of reply.tool_calls) {
      const result = await dispatch(call)
      messages.push({ role: 'tool', content: result })
    }
  }
}
