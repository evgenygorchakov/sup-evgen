const THINKING_MODELS = new Set(['qwen3.5:35b', 'qwen3.6', 'qwen3.5:9b'])

export const Config = {
  PROVIDER: 'ollama',
  HOST: 'http://host.docker.internal:11434',
  // MODEL: 'gpt-oss',
  // MODEL: 'qwen3.5:35b',
  MODEL: 'qwen3.6',
  // MODEL: 'qwen3.5:9b',
  LANGUAGE: 'russian',
  USE_PLAN_MODE: false,
  USE_DETAILED_COMMAND_EXPLANATION: true,
  USE_NATIVE_OLLAMA_TOOLS: true,
  USE_THINKING: true,
  USE_STREAMING: true,
} as const

export type ThinkingMode = false | true | 'low' | 'medium' | 'high'

export function getThinkingModeFor(model: string): ThinkingMode {
  if (!Config.USE_THINKING) {
    return false
  }

  if (model === 'gpt-oss') {
    return 'high'
  }

  return THINKING_MODELS.has(model)
}
