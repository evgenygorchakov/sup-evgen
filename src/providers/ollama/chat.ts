import type { Message, OnChunk, ToolCall, ToolDefinition } from '../../types.ts'
import { Config, useThink } from '../../config.ts'

const HOST = Config.HOST
const MODEL = Config.MODEL
const REQUEST_TIMEOUT_MS = 300_000

export async function chat(
  messages: Message[],
  tools?: ToolDefinition[],
  format?: object,
  onChunk?: OnChunk,
): Promise<Message> {
  const stream = Boolean(onChunk) && Config.USE_STREAMING

  const res = await fetch(`${HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      format,
      think: useThink(MODEL),
      stream,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`)
  }

  if (!stream) {
    const data: unknown = await res.json()

    if (typeof data !== 'object' || data === null || !('message' in data) || typeof (data as { message: unknown }).message !== 'object') {
      throw new Error('Ollama returned unexpected response shape')
    }

    return (data as { message: Message }).message
  }

  return await readStream(res, onChunk!)
}

async function readStream(res: Response, onChunk: OnChunk): Promise<Message> {
  if (!res.body) {
    throw new Error('Ollama stream has no body')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const assembled: Message = { role: 'assistant', content: '' }
  let thinking = ''

  while (true) {
    const { value, done } = await reader.read()

    if (done)
      break

    buffer += decoder.decode(value, { stream: true })

    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      newlineIndex = buffer.indexOf('\n')

      if (!line)
        continue

      const parsed = parseLine(line)
      if (!parsed)
        continue

      if (parsed.error) {
        throw new Error(`Ollama stream error: ${parsed.error}`)
      }

      if (parsed.message) {
        const m = parsed.message

        if (typeof m.role === 'string') {
          assembled.role = m.role as Message['role']
        }

        if (typeof m.content === 'string' && m.content.length > 0) {
          assembled.content += m.content
          onChunk({ content: m.content })
        }

        if (typeof m.thinking === 'string' && m.thinking.length > 0) {
          thinking += m.thinking
          onChunk({ thinking: m.thinking })
        }

        if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
          assembled.tool_calls = m.tool_calls as ToolCall[]
        }
      }

      if (parsed.done) {
        return assembled
      }
    }
  }

  const tail = buffer.trim()
  if (tail) {
    const parsed = parseLine(tail)
    if (parsed?.message?.content && typeof parsed.message.content === 'string') {
      assembled.content += parsed.message.content
      onChunk({ content: parsed.message.content })
    }
  }

  return assembled
}

interface StreamLine {
  message?: {
    role?: unknown
    content?: unknown
    thinking?: unknown
    tool_calls?: unknown
  }
  done?: boolean
  error?: string
}

function parseLine(line: string): StreamLine | null {
  try {
    const parsed: unknown = JSON.parse(line)
    if (typeof parsed !== 'object' || parsed === null)
      return null
    return parsed as StreamLine
  }
  catch {
    return null
  }
}
