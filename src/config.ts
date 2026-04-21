export const Config = {
  PROVIDER: 'ollama',
  HOST: 'http://host.docker.internal:11434',
  MODEL: 'gpt-oss',
  // MODEL: 'qwen3.5:35b',
  LANGUAGE: 'russian',
  USE_PLAN_MODE: true,
  USE_DETAILED_COMMAND_EXPLANATION: false,
  USE_NATIVE_OLLAMA_TOOLS: false,
} as const
