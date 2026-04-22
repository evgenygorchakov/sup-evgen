import type { Interface as ReadlineInterface } from 'node:readline/promises'
import type { ChatProvider } from './providers/types.ts'
import type {
  ConfirmResult,
  Message,
  OnStreamPart,
  StreamPart,
  Tool,
  ToolCall,
  ToolDefinition,
} from './types.ts'

import process from 'node:process'
import { Config } from './config.ts'

import { readFile } from './tools/read-file.ts'
import { runShell } from './tools/run-shell.ts'
import { writeFile } from './tools/write-file.ts'
import { CONFIRM_KIND } from './types.ts'
import { bold, brightBlue, brightGreen, gray, red, yellow } from './utils/colors.ts'

const language = Config.LANGUAGE
const detailedExplanationEnabled = Config.USE_DETAILED_COMMAND_EXPLANATION
const planModeEnabled = Config.USE_PLAN_MODE

const MAX_TOOL_ITERATIONS = 10

const EXPLAIN_CALLS_MESSAGE = `Before executing, briefly explain in ${language} what each tool call you just proposed will do. Quote each call and add one short sentence below it. Do not call tools.`
const PLAN_REQUEST_MESSAGE = `Before doing anything, describe in 2-4 short sentences in ${language} what you plan to do to answer the user. Do not call tools. Wait for approval.`

const availableTools: Tool[] = [runShell, readFile, writeFile]
const toolDefinitions: ToolDefinition[] = availableTools.map(tool => tool.definition)
const toolsByName: Record<string, Tool> = Object.fromEntries(
  availableTools.map(tool => [tool.definition.function.name, tool]),
)

async function runTool(call: ToolCall): Promise<string> {
  const tool = toolsByName[call.function.name]
  if (!tool) {
    return `Unknown tool: ${call.function.name}`
  }

  console.error(gray(`→ ${call.function.name}(${JSON.stringify(call.function.arguments)})`))

  return await tool
    .handler(call.function.arguments)
    .catch((error: Error) => `ERROR: ${error.message}`)
}

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

interface StreamPrinter {
  onStreamPart: OnStreamPart
  didPrintAnything: () => boolean
}

function createStreamPrinter(colorize: (text: string) => string): StreamPrinter {
  let printedAnything = false
  let lastPrintedKind: 'content' | 'thinking' | null = null

  const onStreamPart: OnStreamPart = (part: StreamPart) => {
    if (part.thinking) {
      if (lastPrintedKind === 'content') {
        process.stderr.write('\n')
      }
      printedAnything = true
      lastPrintedKind = 'thinking'
      process.stderr.write(gray(part.thinking))
    }

    if (part.content) {
      if (lastPrintedKind === 'thinking') {
        process.stderr.write('\n')
      }
      printedAnything = true
      lastPrintedKind = 'content'
      process.stderr.write(colorize(part.content))
    }
  }

  return { onStreamPart, didPrintAnything: () => printedAnything }
}

async function askForPlanApproval(provider: ChatProvider, messages: Message[], readline: ReadlineInterface): Promise<'proceed' | 'quit'> {
  while (true) {
    console.warn(bold(brightBlue('\nProposed plan:')))

    const { onStreamPart, didPrintAnything } = createStreamPrinter(yellow)
    const plan = await provider.chat(
      [...messages, { role: 'user', content: PLAN_REQUEST_MESSAGE }],
      [],
      onStreamPart,
    )

    if (didPrintAnything()) {
      process.stderr.write('\n')
    }
    else {
      const planText = plan.content.trim()
      if (planText) {
        console.warn(yellow(planText))
      }
    }

    const userAnswer = (await readline.question(brightGreen('\n[y / n / type feedback] '))).trim()
    const loweredAnswer = userAnswer.toLowerCase()

    if (loweredAnswer === 'y') {
      messages.push(plan)
      return 'proceed'
    }

    if (!userAnswer || loweredAnswer === 'n') {
      return 'quit'
    }

    messages.push(plan)
    messages.push({ role: 'user', content: userAnswer })
  }
}

async function confirmToolCalls(calls: ToolCall[], intent: string, readline: ReadlineInterface): Promise<ConfirmResult> {
  const trimmedIntent = intent.trim()
  if (trimmedIntent) {
    console.warn(`\n${yellow(trimmedIntent)}`)
  }

  console.warn(bold(brightBlue('\nModel wants to run:')))

  for (const call of calls) {
    console.warn(` ${call.function.name}(${JSON.stringify(call.function.arguments)})`)
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

export async function run(provider: ChatProvider, messages: Message[], readline: ReadlineInterface): Promise<void> {
  if (planModeEnabled && messages[messages.length - 1]?.role === 'user') {
    const decision = await askForPlanApproval(provider, messages, readline)

    if (decision === 'quit') {
      console.error(red('Cancelled by user.'))
      return
    }
  }

  let iterations = 0

  while (true) {
    const { onStreamPart, didPrintAnything } = createStreamPrinter(text => text)
    const reply = await provider.chat(messages, toolDefinitions, onStreamPart)

    messages.push(reply)

    if (!reply.tool_calls?.length) {
      if (didPrintAnything()) {
        process.stderr.write('\n')
      }
      else if (reply.content) {
        console.warn(reply.content)
      }
      return
    }

    if (didPrintAnything()) {
      process.stderr.write('\n')
    }

    iterations += 1
    if (iterations > MAX_TOOL_ITERATIONS) {
      console.error(red(`Reached max tool iterations (${MAX_TOOL_ITERATIONS}). Stopping this turn.`))
      messages.push({ role: 'user', content: `Stopped: exceeded ${MAX_TOOL_ITERATIONS} tool calls in a single turn. Summarize progress and wait for the user.` })
      return
    }

    const explanation = detailedExplanationEnabled ? await askModelToExplainCalls(provider, messages) : ''
    const intent = explanation || reply.content
    const decision = await confirmToolCalls(reply.tool_calls, intent, readline)

    if (decision.kind === CONFIRM_KIND.quit) {
      console.error(red('Cancelled by user.'))
      return
    }

    if (decision.kind === CONFIRM_KIND.replan) {
      for (const call of reply.tool_calls) {
        messages.push({
          role: 'tool',
          content: 'Rejected by user. Do not run this command.',
          tool_call_id: call.id,
        })
      }

      messages.push({ role: 'user', content: decision.feedback })
      continue
    }

    for (const call of reply.tool_calls) {
      const toolResult = await runTool(call)
      messages.push({ role: 'tool', content: toolResult, tool_call_id: call.id })
    }
  }
}
