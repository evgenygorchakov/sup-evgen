import type { Message, OnChunk, ToolDefinition } from '../../types.ts'
import type { ChatProvider } from '../types.ts'

import { Config } from '../../config.ts'
import { chat as rawChat } from './chat.ts'
import { buildReplyFormat, buildToolsInstruction, tryParsePromptToolsReply } from './prompt-tools.ts'

const REFORMAT_REQUEST = 'Your previous reply was not a valid JSON object matching the required schema. Resend the SAME answer as strict JSON with fields "message" and "tool_calls". No prose, no code fences, no string concatenation — just one JSON object.'
const FALLBACK_MESSAGE = 'The model returned a malformed reply. Please try again.'

const useNative = Config.USE_NATIVE_OLLAMA_TOOLS

function withToolsInstruction(messages: Message[], instruction: string): Message[] {
  const first = messages[0]

  if (first?.role === 'system') {
    return [{ ...first, content: `${first.content}\n\n${instruction}` }, ...messages.slice(1)]
  }

  return [{ role: 'system', content: instruction }, ...messages]
}

async function chat(messages: Message[], tools: ToolDefinition[], onChunk?: OnChunk): Promise<Message> {
  if (!tools.length) {
    return await rawChat(messages, undefined, undefined, onChunk)
  }

  if (useNative) {
    return await rawChat(messages, tools, undefined, onChunk)
  }

  const prepared = withToolsInstruction(messages, buildToolsInstruction(tools))
  const format = buildReplyFormat(tools)

  const reply = await rawChat(prepared, undefined, format)

  const parsed = tryParsePromptToolsReply(reply.content)

  if (parsed) {
    reply.content = parsed.message

    if (parsed.tool_calls.length) {
      reply.tool_calls = parsed.tool_calls
    }

    return reply
  }

  const retry = await rawChat(
    [...prepared, reply, { role: 'user', content: REFORMAT_REQUEST }],
    undefined,
    format,
  )

  const retryParsed = tryParsePromptToolsReply(retry.content)

  if (retryParsed) {
    reply.content = retryParsed.message

    if (retryParsed.tool_calls.length) {
      reply.tool_calls = retryParsed.tool_calls
    }

    return reply
  }

  reply.content = FALLBACK_MESSAGE
  return reply
}

export const ollama: ChatProvider = { chat }
