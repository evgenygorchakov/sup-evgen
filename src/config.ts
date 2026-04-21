export const Config = {
  PROVIDER: 'ollama',
  HOST: 'http://host.docker.internal:11434',
  // MODEL: 'gpt-oss',
  // MODEL: 'qwen3.5:35b',
  MODEL: 'qwen3.6',
  LANGUAGE: 'russian',
  USE_PLAN_MODE: false,
  USE_DETAILED_COMMAND_EXPLANATION: true,
  USE_NATIVE_OLLAMA_TOOLS: true,
  USE_THINKING: true,
  USE_STREAMING: true,
} as const

export function useThink(model: string): boolean | string {
  if (!Config.USE_THINKING) {
    return false
  }

  if (model === 'gpt-oss') {
    return 'high'
  }

  return ['qwen3.5:35b', 'qwen3.6'].includes(model)
}
