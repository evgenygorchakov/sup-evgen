import type { ChatProvider } from './types.ts'
import { Config } from '../config.ts'
import { ollama } from './ollama/index.ts'

export function getProvider(): ChatProvider {
  const name = Config.PROVIDER

  switch (name) {
    case 'ollama':
      return ollama
    default:
      throw new Error(`Unknown provider: ${name}`)
  }
}
