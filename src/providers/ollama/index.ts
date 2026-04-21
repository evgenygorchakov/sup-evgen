import type { Message, ToolDefinition } from '../../types.ts'
import type { ChatProvider } from '../types.ts'

import { getConfigValue } from '../../utils/env.ts'
import { chat as rawChat } from './chat.ts'
import { buildReplyFormat, buildToolsInstruction, parsePromptToolsReply } from './prompt-tools.ts'

const useNative = getConfigValue('USE_NATIVE_OLLAMA_TOOLS')

function withToolsInstruction(messages: Message[], instruction: string): Message[] {
  const first = messages[0]

  if (first?.role === 'system') {
    return [{ ...first, content: `${first.content}\n\n${instruction}` }, ...messages.slice(1)]
  }

  return [{ role: 'system', content: instruction }, ...messages]
}

async function chat(messages: Message[], tools: ToolDefinition[]): Promise<Message> {
  if (useNative) {
    return await rawChat(messages, tools)
  }

  const prepared = withToolsInstruction(messages, buildToolsInstruction(tools))
  const reply = await rawChat(prepared, undefined, buildReplyFormat(tools))

  try {
    const parsed = parsePromptToolsReply(reply.content)
    reply.content = parsed.message

    if (parsed.tool_calls.length) {
      reply.tool_calls = parsed.tool_calls
    }
  }
  catch {
    // malformed JSON — leave reply as-is so caller sees raw content
  }

  return reply
}

export const ollama: ChatProvider = { chat }
