import type { Interface as ReadlineInterface } from 'node:readline/promises'
import type { ChatProvider } from './providers/types.ts'
import type { Message } from './types.ts'
import process from 'node:process'

import { Config } from './config.ts'
import { canAutoApproveCall } from './tools/auto-approve.ts'
import { runTool, toolDefinitions, toolsByName } from './tools/registry.ts'
import { CONFIRM_KIND, confirmToolCalls } from './ui/confirm.ts'
import { askForPlanApproval } from './ui/plan-approval.ts'
import { renderToolHeader } from './ui/render-tool-call.ts'
import { createStreamPrinter } from './ui/stream-printer.ts'
import { red } from './utils/colors.ts'

const MAX_TOOL_ITERATIONS = 10

export async function run(provider: ChatProvider, messages: Message[], readline: ReadlineInterface): Promise<void> {
  if (Config.USE_PLAN_MODE && messages[messages.length - 1]?.role === 'user') {
    const decision = await askForPlanApproval(provider, messages, readline)

    if (decision === 'quit') {
      console.error(red('Cancelled by user.'))
      return
    }
  }

  let iterations = 0

  while (true) {
    const { onStreamPart, didPrintAnything, didPrintContent } = createStreamPrinter(text => text)
    const reply = await provider.chat(messages, toolDefinitions, onStreamPart)

    messages.push(reply)

    if (!reply.tool_calls?.length) {
      if (didPrintAnything()) {
        process.stderr.write('\n')
      }

      if (!didPrintContent() && reply.content) {
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

    const canAutoApproveBatch = Config.USE_PERMISSION_ALLOWLIST && reply.tool_calls.every(canAutoApproveCall)

    if (canAutoApproveBatch) {
      for (const call of reply.tool_calls) {
        console.warn(renderToolHeader(call, toolsByName[call.function.name]))
      }
    }
    else {
      const decision = await confirmToolCalls(provider, messages, reply.tool_calls, reply.content, readline)

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
    }

    for (const call of reply.tool_calls) {
      const toolResult = await runTool(call)
      messages.push({ role: 'tool', content: toolResult, tool_call_id: call.id })
    }
  }
}
