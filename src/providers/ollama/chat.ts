import type { Message, ToolDefinition } from '../../types.ts'
import { Config } from '../../config.ts'

const HOST = Config.HOST
const MODEL = Config.MODEL
const REQUEST_TIMEOUT_MS = 300_000

function canThink(model: string): boolean | string {
  if (model === 'gpt-oss') {
    return 'high'
  }

  return ['qwen3.5:35b'].includes(model)
}

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
      think: canThink(MODEL),
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
