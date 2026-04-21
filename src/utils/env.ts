const CONFIG = {
  PROVIDER: 'ollama',
  OLLAMA_HOST: 'http://host.docker.internal:11434',
  OLLAMA_MODEL: 'gpt-oss:latest',
  LANGUAGE: 'russian',
  USE_NATIVE_OLLAMA_TOOLS: false,
  MAX_AGENT_ITERATIONS: 20,
} as const

export function getConfigValue(name) {
  if (CONFIG[name] !== undefined) {
    return CONFIG[name]
  }

  throw new Error(`Missing var: ${name}.`)
}
