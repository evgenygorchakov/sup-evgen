import type { ChatProvider } from './types.ts'
import { getConfigValue } from '../utils/env.ts'
import { ollama } from './ollama/index.ts'

export function getProvider(): ChatProvider {
  const name = getConfigValue('PROVIDER').toLowerCase()
  switch (name) {
    case 'ollama':
      return ollama
    default:
      throw new Error(`Unknown provider: ${name}`)
  }
}
