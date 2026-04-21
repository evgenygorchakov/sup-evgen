import type { ChatProvider } from './providers/types.ts'
import type {
  ConfirmResult,
  Message,
  Tool,
  ToolCall,
  ToolDefinition,
} from './types.ts'

import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'

import { runShell } from './tools/run-shell.ts'

import { CONFIRM_KIND } from './types.ts'
import { bold, brightBlue, brightGreen, gray, red, yellow } from './utils/colors.ts'
import { getConfigValue } from './utils/env.ts'

const maxIterations = getConfigValue('MAX_AGENT_ITERATIONS')
const language = getConfigValue('LANGUAGE')

const EXPLAIN_CALLS_MESSAGE = `Before executing, briefly explain in ${language} what each tool call you just proposed will do. Quote each call and add one short sentence below it. Do not call tools.`

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

async function confirmBatch(calls: ToolCall[], intent: string): Promise<ConfirmResult> {
  const trimmed = intent.trim()
  if (trimmed) {
    console.warn(`\n${yellow(trimmed)}`)
  }

  console.warn(bold(brightBlue('\nModel wants to run:')))
  for (const call of calls) {
    console.warn(` ${call.function.name}(${JSON.stringify(call.function.arguments)})`)
  }

  const rl = createInterface({ input: stdin, output: stdout })

  try {
    const answer = (await rl.question(brightGreen('\n[y / n / type feedback] '))).trim()
    const lowered = answer.toLowerCase()

    if (lowered === 'y')
      return { kind: CONFIRM_KIND.approve }
    if (!answer || lowered === 'n')
      return { kind: CONFIRM_KIND.quit }

    return { kind: CONFIRM_KIND.replan, feedback: answer }
  }
  finally {
    rl.close()
  }
}

export async function run(provider: ChatProvider, messages: Message[]): Promise<void> {
  for (let i = 0; i < maxIterations; i++) {
    const reply = await provider.chat(messages, tools)

    messages.push(reply)

    if (!reply.tool_calls?.length) {
      console.warn(reply.content)
      return
    }

    const explanation = await explainCalls(provider, messages)

    const intent = explanation || reply.content
    const decision = await confirmBatch(reply.tool_calls, intent)

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

  console.error(red(`Reached MAX_ITERATIONS (${maxIterations}) without final answer.`))
}
