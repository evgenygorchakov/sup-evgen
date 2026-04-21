const Config = {
  PROVIDER: 'ollama',
  OLLAMA_HOST: 'http://host.docker.internal:11434',
  OLLAMA_MODEL: 'gpt-oss:latest',
  LANGUAGE: 'russian',
  USE_NATIVE_OLLAMA_TOOLS: false,
} as const

export function getConfigValue(name: keyof typeof Config) {
  if (Config[name] !== undefined) {
    return Config[name]
  }

  throw new Error(`Missing var: ${name}.`)
}
