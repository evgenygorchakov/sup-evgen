import type { Message, ToolDefinition } from '../../types.ts'
import { getEnvValue } from '../../utils/env.ts'

const HOST = getEnvValue('OLLAMA_HOST')
const MODEL = getEnvValue('OLLAMA_MODEL')
const REQUEST_TIMEOUT_MS = 300_000

export async function chat(
  messages: Message[],
  tools?: ToolDefinition[],
  format?: object,
): Promise<Message> {
  const res = await fetch(`${HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      format,
      stream: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`)
  }

  const data: unknown = await res.json()

  if (typeof data !== 'object' || data === null || !('message' in data) || typeof (data as { message: unknown }).message !== 'object') {
    throw new Error('Ollama returned unexpected response shape')
  }

  return (data as { message: Message }).message
}
